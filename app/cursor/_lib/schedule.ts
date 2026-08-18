import type { Assignment, Engineer, Phase, Project, ScheduleIntent, Sprint } from "@/lib/schema";

const EPS = 0.001;

export type CellSegment = {
  sprintId: string;
  engineerId: string;
  phaseId: string;
  projectId: string;
  days: number;
  allocatedFraction: number;
  requestedFraction: number;
  /** Eligible this sprint but received no days (queued behind higher priority). */
  unfilled: boolean;
};

export type EngineerSprintLoad = {
  sprintId: string;
  engineerId: string;
  capacityDays: number;
  timeOffDays: number;
  timeOffPlacement: "start" | "end";
  deliveredDays: number;
  idleDays: number;
  requestedFractionSum: number;
  allocatedFractionSum: number;
  overloaded: boolean;
};

export type PhaseTimeline = {
  phaseId: string;
  projectId: string;
  startSprintId: string | null;
  endSprintId: string | null;
  remainingDays: number;
  unscheduled: boolean;
  delayed: boolean;
  predecessorId: string | null;
  whyStart: string;
};

export type ScheduleAlert = {
  id: string;
  kind: "overload" | "unscheduled" | "idle_with_gap" | "delayed";
  message: string;
  engineerId?: string;
  sprintId?: string;
  phaseId?: string;
  projectId?: string;
};

export type ScheduleResult = {
  segments: CellSegment[];
  loads: EngineerSprintLoad[];
  phaseTimelines: PhaseTimeline[];
  alerts: ScheduleAlert[];
  currentSprintId: string | null;
  planningStartSprintId: string | null;
  planningStartIndex: number;
};

function todayIso(today?: string) {
  return today ?? new Date().toISOString().slice(0, 10);
}

export function findCurrentSprint(sprints: Sprint[], today?: string): Sprint | null {
  if (sprints.length === 0) return null;
  const day = todayIso(today);
  const containing = sprints.find((s) => s.startDate <= day && s.endDate >= day);
  if (containing) return containing;
  const future = sprints.find((s) => s.startDate > day);
  return future ?? sprints[sprints.length - 1] ?? null;
}

function predecessorOf(phase: Phase, phases: Phase[]): Phase | null {
  const siblings = phases
    .filter((p) => p.projectId === phase.projectId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  const idx = siblings.findIndex((p) => p.id === phase.id);
  return idx > 0 ? siblings[idx - 1]! : null;
}

function projectById(projects: Project[], id: string) {
  return projects.find((p) => p.id === id);
}

function engineerById(engineers: Engineer[], id: string) {
  return engineers.find((e) => e.id === id);
}

function isEligible(
  phase: Phase,
  remaining: Map<string, number>,
  pred: Phase | null,
): boolean {
  if ((remaining.get(phase.id) ?? 0) <= EPS) return false;
  if (!pred) return true;
  if (phase.parallelOk) return true;
  return (remaining.get(pred.id) ?? 0) <= EPS;
}

function byPriority(
  items: { phaseId: string; fraction: number; priority: number; sortOrder: number }[],
) {
  return [...items].sort(
    (a, b) =>
      a.priority - b.priority || a.sortOrder - b.sortOrder || a.phaseId.localeCompare(b.phaseId),
  );
}

/** Pour capacity into eligible work in priority order. A short high-priority
 *  phase does not reserve a full sprint; leftover days go to the next assignment. */
function waterfillEngineer(
  items: { phaseId: string; fraction: number; priority: number; sortOrder: number }[],
  capacityDays: number,
  remaining: Map<string, number>,
) {
  let leftoverDays = capacityDays;
  return byPriority(items).map((item) => {
    const requestedDays = item.fraction * capacityDays;
    const days = Math.min(
      requestedDays,
      leftoverDays,
      Math.max(0, remaining.get(item.phaseId) ?? 0),
    );
    leftoverDays = Math.max(0, leftoverDays - days);
    return {
      ...item,
      requested: item.fraction,
      days,
      allocated: capacityDays > EPS ? days / capacityDays : 0,
    };
  });
}

function effectiveDemand(
  items: { phaseId: string; fraction: number }[],
  capacityDays: number,
  remaining: Map<string, number>,
) {
  if (capacityDays <= EPS) return 0;
  return items.reduce((sum, item) => {
    const canUse = Math.min(
      item.fraction,
      Math.max(0, remaining.get(item.phaseId) ?? 0) / capacityDays,
    );
    return sum + canUse;
  }, 0);
}

export function schedule(intent: ScheduleIntent, today?: string): ScheduleResult {
  const sprints = [...intent.sprints].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const engineers = [...intent.engineers].sort((a, b) => a.sortOrder - b.sortOrder);
  const phases = [...intent.phases];
  const projects = intent.projects;
  const assignments = intent.assignments;
  const timeOff = intent.timeOff;

  const current = findCurrentSprint(sprints, today);
  const planningStartIndex = current
    ? Math.max(0, sprints.findIndex((s) => s.id === current.id))
    : 0;
  const horizon = sprints.slice(planningStartIndex);

  const remaining = new Map<string, number>();
  for (const phase of phases) remaining.set(phase.id, phase.effortDays);

  const predByPhase = new Map<string, Phase | null>();
  for (const phase of phases) predByPhase.set(phase.id, predecessorOf(phase, phases));

  const assignmentsByEngineer = new Map<string, Assignment[]>();
  for (const row of assignments) {
    const list = assignmentsByEngineer.get(row.engineerId) ?? [];
    list.push(row);
    assignmentsByEngineer.set(row.engineerId, list);
  }

  const segments: CellSegment[] = [];
  const loads: EngineerSprintLoad[] = [];
  const firstDelivery = new Map<string, string>();
  const lastDelivery = new Map<string, string>();

  for (const sprint of horizon) {
    const eligible = new Set(
      phases
        .filter((phase) => isEligible(phase, remaining, predByPhase.get(phase.id) ?? null))
        .map((p) => p.id),
    );

    type Intended = {
      engineerId: string;
      phaseId: string;
      projectId: string;
      days: number;
      allocatedFraction: number;
      requestedFraction: number;
    };
    const intended: Intended[] = [];

    for (const engineer of engineers) {
      const leave = timeOff.find(
        (t) => t.engineerId === engineer.id && t.sprintId === sprint.id,
      );
      const daysOff = leave?.daysOff ?? 0;
      const capacityDays = Math.max(0, engineer.fte * sprint.workingDays - daysOff);
      const eligibleRows = (assignmentsByEngineer.get(engineer.id) ?? []).filter((a) =>
        eligible.has(a.phaseId),
      );
      const fractionItems = eligibleRows.map((row) => {
        const phase = phases.find((p) => p.id === row.phaseId)!;
        const project = projectById(projects, phase.projectId)!;
        return {
          phaseId: row.phaseId,
          fraction: row.fraction,
          priority: project.priority,
          sortOrder: phase.sortOrder,
        };
      });
      const filled = waterfillEngineer(fractionItems, capacityDays, remaining);
      const demand = effectiveDemand(fractionItems, capacityDays, remaining);
      const allocatedSum = filled.reduce((sum, row) => sum + row.allocated, 0);

      for (const row of filled) {
        if (row.requested <= EPS) continue;
        const phase = phases.find((p) => p.id === row.phaseId)!;
        intended.push({
          engineerId: engineer.id,
          phaseId: row.phaseId,
          projectId: phase.projectId,
          days: row.days,
          allocatedFraction: row.allocated,
          requestedFraction: row.requested,
        });
      }

      loads.push({
        sprintId: sprint.id,
        engineerId: engineer.id,
        capacityDays,
        timeOffDays: daysOff,
        timeOffPlacement: leave?.placement === "end" ? "end" : "start",
        deliveredDays: 0,
        idleDays: capacityDays,
        requestedFractionSum: demand,
        allocatedFractionSum: allocatedSum,
        overloaded: demand > 1 + EPS,
      });
    }

    const byPhase = new Map<string, Intended[]>();
    for (const row of intended) {
      const list = byPhase.get(row.phaseId) ?? [];
      list.push(row);
      byPhase.set(row.phaseId, list);
    }

    const deliveredByEngineer = new Map<string, number>();

    for (const [phaseId, rows] of byPhase) {
      const left = remaining.get(phaseId) ?? 0;
      const totalIntended = rows.reduce((sum, r) => sum + r.days, 0);
      const scale = totalIntended > left && totalIntended > EPS ? left / totalIntended : 1;
      let used = 0;
      for (const row of rows) {
        const days = row.days * scale;
        const unfilled = days <= EPS;
        if (!unfilled) {
          used += days;
          deliveredByEngineer.set(
            row.engineerId,
            (deliveredByEngineer.get(row.engineerId) ?? 0) + days,
          );
          if (!firstDelivery.has(phaseId)) firstDelivery.set(phaseId, sprint.id);
          lastDelivery.set(phaseId, sprint.id);
        }
        segments.push({
          sprintId: sprint.id,
          engineerId: row.engineerId,
          phaseId: row.phaseId,
          projectId: row.projectId,
          days,
          allocatedFraction: row.allocatedFraction,
          requestedFraction: row.requestedFraction,
          unfilled,
        });
      }
      remaining.set(phaseId, Math.max(0, left - used));
    }

    for (const load of loads.filter((l) => l.sprintId === sprint.id)) {
      const delivered = deliveredByEngineer.get(load.engineerId) ?? 0;
      load.deliveredDays = delivered;
      load.idleDays = Math.max(0, load.capacityDays - delivered);
    }
  }

  const sprintIndex = new Map(horizon.map((s, i) => [s.id, i]));
  const planningStartSprintId = horizon[0]?.id ?? null;

  const phaseTimelines: PhaseTimeline[] = phases.map((phase) => {
    const pred = predByPhase.get(phase.id) ?? null;
    const assigned = assignments.some((a) => a.phaseId === phase.id);
    const unscheduled = !assigned && phase.effortDays > EPS;
    const startSprintId = firstDelivery.get(phase.id) ?? null;
    const endSprintId = lastDelivery.get(phase.id) ?? null;
    const remainingDays = remaining.get(phase.id) ?? 0;

    let expectedIndex = 0;
    if (pred) {
      const predEnd = lastDelivery.get(pred.id);
      expectedIndex = predEnd != null ? (sprintIndex.get(predEnd) ?? 0) + 1 : 0;
    }
    const actualIndex = startSprintId != null ? (sprintIndex.get(startSprintId) ?? 0) : null;
    const delayed =
      assigned &&
      (actualIndex == null || actualIndex > expectedIndex + EPS) &&
      !unscheduled &&
      (pred != null || (actualIndex != null && actualIndex > 0));

    const whyStart = explainStart({
      phase,
      pred,
      assigned,
      unscheduled,
      startSprintId,
      delayed,
      expectedIndex,
      horizon,
      assignments,
      projects,
      engineers,
      phases,
    });

    return {
      phaseId: phase.id,
      projectId: phase.projectId,
      startSprintId,
      endSprintId,
      remainingDays,
      unscheduled,
      delayed: Boolean(delayed && assigned && !unscheduled),
      predecessorId: pred?.id ?? null,
      whyStart,
    };
  });

  const alerts = buildAlerts({
    loads,
    phaseTimelines,
    phases,
    projects,
    engineers,
    sprints: horizon,
  });

  return {
    segments,
    loads,
    phaseTimelines,
    alerts,
    currentSprintId: current?.id ?? null,
    planningStartSprintId,
    planningStartIndex,
  };
}

function explainStart(args: {
  phase: Phase;
  pred: Phase | null;
  assigned: boolean;
  unscheduled: boolean;
  startSprintId: string | null;
  delayed: boolean;
  expectedIndex: number;
  horizon: Sprint[];
  assignments: Assignment[];
  projects: Project[];
  engineers: Engineer[];
  phases: Phase[];
}) {
  const {
    phase,
    pred,
    assigned,
    unscheduled,
    startSprintId,
    delayed,
    expectedIndex,
    horizon,
    assignments,
    projects,
    engineers,
  } = args;

  if (unscheduled) return "Unassigned — sitting in the unscheduled bucket.";
  if (!assigned) return "No assignments.";

  const start = horizon.find((s) => s.id === startSprintId);
  const expected = horizon[expectedIndex];

  if (!start) {
    return pred
      ? `Assigned, but never starts in this horizon. Waiting on ${pred.name} or higher-priority work.`
      : "Assigned, but never starts in this horizon (capacity went to higher-priority work).";
  }

  if (pred && !delayed) {
    return `Starts after ${pred.name} (${expected?.name ?? "previous sprint"}).`;
  }

  if (delayed) {
    const people = assignments
      .filter((a) => a.phaseId === phase.id)
      .map((a) => engineerById(engineers, a.engineerId)?.name ?? a.engineerId);
    const higher = projects
      .filter((p) => p.priority < (projectById(projects, phase.projectId)?.priority ?? 99))
      .map((p) => p.name);
    const who = people.join(", ") || "the assigned engineer";
    const blocker = higher[0] ? higher.join(", ") : "higher-priority work";
    return `Queued behind ${blocker} on ${who}. Expected ${expected?.name ?? "earlier"}; starts ${start.name}.`;
  }

  return `Starts ${start.name}.`;
}

function buildAlerts(args: {
  loads: EngineerSprintLoad[];
  phaseTimelines: PhaseTimeline[];
  phases: Phase[];
  projects: Project[];
  engineers: Engineer[];
  sprints: Sprint[];
}): ScheduleAlert[] {
  const { loads, phaseTimelines, phases, projects, engineers, sprints } = args;
  const alerts: ScheduleAlert[] = [];
  const phaseName = (id: string) => phases.find((p) => p.id === id)?.name ?? id;
  const projectLabel = (id: string) => {
    const project = projects.find((p) => p.id === id);
    if (!project) return id;
    const code = project.code?.trim();
    return code ? `${code} ${project.name}` : project.name;
  };
  const engineerName = (id: string) => engineers.find((e) => e.id === id)?.name ?? id;
  const sprintName = (id: string) => sprints.find((s) => s.id === id)?.name ?? id;

  for (const load of loads) {
    if (!load.overloaded) continue;
    alerts.push({
      id: `overload:${load.engineerId}:${load.sprintId}`,
      kind: "overload",
      message: `${engineerName(load.engineerId)} over-allocated in ${sprintName(load.sprintId)} (${Math.round(load.requestedFractionSum * 100)}% requested).`,
      engineerId: load.engineerId,
      sprintId: load.sprintId,
    });
  }

  for (const timeline of phaseTimelines) {
    if (!timeline.unscheduled) continue;
    alerts.push({
      id: `unscheduled:${timeline.phaseId}`,
      kind: "unscheduled",
      message: `${projectLabel(timeline.projectId)} · ${phaseName(timeline.phaseId)} has effort and no assignments.`,
      phaseId: timeline.phaseId,
      projectId: timeline.projectId,
    });
  }

  const hasIdle = loads.some((l) => l.idleDays > EPS);
  const unscheduled = phaseTimelines.filter((t) => t.unscheduled);
  if (hasIdle && unscheduled.length > 0) {
    const idleEngineer = loads.find((l) => l.idleDays > EPS);
    alerts.push({
      id: "idle_with_gap",
      kind: "idle_with_gap",
      message: `${unscheduled.length} unscheduled phase${unscheduled.length === 1 ? "" : "s"} while someone has slack.`,
      engineerId: idleEngineer?.engineerId,
      sprintId: idleEngineer?.sprintId,
      phaseId: unscheduled[0]?.phaseId,
      projectId: unscheduled[0]?.projectId,
    });
  }

  for (const timeline of phaseTimelines) {
    if (!timeline.delayed) continue;
    alerts.push({
      id: `delayed:${timeline.phaseId}`,
      kind: "delayed",
      message: `${projectLabel(timeline.projectId)} · ${phaseName(timeline.phaseId)} starts late. ${timeline.whyStart}`,
      phaseId: timeline.phaseId,
      projectId: timeline.projectId,
    });
  }

  return alerts;
}

export function formatEffortDays(days: number) {
  const weeks = days / 5;
  if (Math.abs(weeks - Math.round(weeks)) < 0.05) {
    const w = Math.round(weeks);
    return `${w}w (${days % 1 === 0 ? days : days.toFixed(1)}d)`;
  }
  return `${weeks.toFixed(1)}w (${days % 1 === 0 ? days : days.toFixed(1)}d)`;
}
