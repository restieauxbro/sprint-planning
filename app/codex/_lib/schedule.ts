import type { ScheduleIntent, Sprint } from "@/lib/schema";

const EPSILON = 0.001;

export type CellSegment = {
  sprintId: string;
  engineerId: string;
  phaseId: string;
  projectId: string;
  days: number;
  allocatedFraction: number;
  requestedFraction: number;
  unfilled: boolean;
};

export type EngineerSprintLoad = {
  sprintId: string;
  engineerId: string;
  capacityDays: number;
  timeOffDays: number;
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

const trimNumber = (value: number) =>
  Number(value.toFixed(2)).toLocaleString("en-AU", { maximumFractionDigits: 2 });

export function formatEffortDays(days: number) {
  return `${trimNumber(days / 5)}w (${trimNumber(days)}d)`;
}

export function findCurrentSprint(sprints: Sprint[], today: string): Sprint | null {
  const sorted = [...sprints].sort((a, b) => a.startDate.localeCompare(b.startDate));
  return (
    sorted.find((sprint) => sprint.startDate <= today && today <= sprint.endDate) ??
    sorted.find((sprint) => sprint.startDate > today) ??
    sorted.at(-1) ??
    null
  );
}

export function schedule(
  intent: ScheduleIntent,
  today = new Date().toISOString().slice(0, 10),
): ScheduleResult {
  const sprints = [...intent.sprints].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );
  const currentSprint = findCurrentSprint(sprints, today);
  const planningStartIndex = currentSprint
    ? sprints.findIndex((sprint) => sprint.id === currentSprint.id)
    : -1;
  const planningSprints = planningStartIndex >= 0 ? sprints.slice(planningStartIndex) : [];
  const projectById = new Map(intent.projects.map((project) => [project.id, project]));
  const engineerById = new Map(intent.engineers.map((engineer) => [engineer.id, engineer]));
  const phaseById = new Map(intent.phases.map((phase) => [phase.id, phase]));
  const sprintIndex = new Map(sprints.map((sprint, index) => [sprint.id, index]));
  const assignmentsByPhase = new Map<string, typeof intent.assignments>();
  const assignmentsByEngineer = new Map<string, typeof intent.assignments>();
  for (const assignment of intent.assignments) {
    assignmentsByPhase.set(assignment.phaseId, [
      ...(assignmentsByPhase.get(assignment.phaseId) ?? []),
      assignment,
    ]);
    assignmentsByEngineer.set(assignment.engineerId, [
      ...(assignmentsByEngineer.get(assignment.engineerId) ?? []),
      assignment,
    ]);
  }

  const predecessor = new Map<string, string | null>();
  for (const project of intent.projects) {
    const phases = intent.phases
      .filter((phase) => phase.projectId === project.id)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
    phases.forEach((phase, index) => predecessor.set(phase.id, phases[index - 1]?.id ?? null));
  }

  const assignmentOrder = (a: (typeof intent.assignments)[number], b: (typeof intent.assignments)[number]) => {
    const phaseA = phaseById.get(a.phaseId)!;
    const phaseB = phaseById.get(b.phaseId)!;
    const projectA = projectById.get(phaseA.projectId)!;
    const projectB = projectById.get(phaseB.projectId)!;
    return (
      projectA.priority - projectB.priority ||
      phaseA.sortOrder - phaseB.sortOrder ||
      phaseA.id.localeCompare(phaseB.id)
    );
  };

  const remaining = new Map(intent.phases.map((phase) => [phase.id, phase.effortDays]));
  const firstDelivery = new Map<string, string>();
  const lastDelivery = new Map<string, string>();
  const segments: CellSegment[] = [];
  const loads: EngineerSprintLoad[] = [];
  const overloadAlerts: ScheduleAlert[] = [];

  for (const sprint of planningSprints) {
    const remainingAtStart = new Map(remaining);
    const eligible = new Set(
      intent.phases
        .filter((phase) => {
          if ((remainingAtStart.get(phase.id) ?? 0) <= EPSILON) return false;
          const predecessorId = predecessor.get(phase.id);
          return (
            !predecessorId ||
            phase.parallelOk === 1 ||
            (remainingAtStart.get(predecessorId) ?? 0) <= EPSILON
          );
        })
        .map((phase) => phase.id),
    );

    type Intended = CellSegment & { intendedDays: number };
    const intended: Intended[] = [];
    const loadDrafts = new Map<
      string,
      Omit<EngineerSprintLoad, "deliveredDays" | "idleDays" | "allocatedFractionSum">
    >();

    for (const engineer of intent.engineers) {
      const timeOffDays = intent.timeOff.find(
        (entry) => entry.engineerId === engineer.id && entry.sprintId === sprint.id,
      )?.daysOff ?? 0;
      const capacityDays = Math.max(0, engineer.fte * sprint.workingDays - timeOffDays);
      let leftoverDays = capacityDays;
      let requestedFractionSum = 0;
      const eligibleAssignments = (assignmentsByEngineer.get(engineer.id) ?? [])
        .filter((assignment) => eligible.has(assignment.phaseId))
        .sort(assignmentOrder);

      for (const assignment of eligibleAssignments) {
        const phase = phaseById.get(assignment.phaseId)!;
        const phaseRemaining = remainingAtStart.get(phase.id) ?? 0;
        const effectiveDemand = capacityDays > EPSILON
          ? Math.min(assignment.fraction, phaseRemaining / capacityDays)
          : 0;
        requestedFractionSum += effectiveDemand;
        const days = Math.min(
          assignment.fraction * capacityDays,
          leftoverDays,
          phaseRemaining,
        );
        intended.push({
          sprintId: sprint.id,
          engineerId: engineer.id,
          phaseId: phase.id,
          projectId: phase.projectId,
          days,
          intendedDays: days,
          allocatedFraction: capacityDays > EPSILON ? days / capacityDays : 0,
          requestedFraction: assignment.fraction,
          unfilled: days <= EPSILON,
        });
        leftoverDays = Math.max(0, leftoverDays - days);
      }

      const overloaded = requestedFractionSum > 1 + EPSILON;
      loadDrafts.set(engineer.id, {
        sprintId: sprint.id,
        engineerId: engineer.id,
        capacityDays,
        timeOffDays,
        requestedFractionSum,
        overloaded,
      });
      if (overloaded) {
        overloadAlerts.push({
          id: `overload:${engineer.id}:${sprint.id}`,
          kind: "overload",
          message: `${engineer.name} over-allocated in ${sprint.name} (${Math.round(requestedFractionSum * 100)}% requested).`,
          engineerId: engineer.id,
          sprintId: sprint.id,
        });
      }
    }

    for (const phase of intent.phases) {
      const phaseIntended = intended.filter(
        (segment) => segment.phaseId === phase.id && segment.intendedDays > EPSILON,
      );
      const totalIntended = phaseIntended.reduce((sum, segment) => sum + segment.intendedDays, 0);
      const available = remainingAtStart.get(phase.id) ?? 0;
      const scale = totalIntended > available + EPSILON ? available / totalIntended : 1;
      for (const segment of phaseIntended) {
        segment.days = segment.intendedDays * scale;
        const capacity = loadDrafts.get(segment.engineerId)?.capacityDays ?? 0;
        segment.allocatedFraction = capacity > EPSILON ? segment.days / capacity : 0;
      }
    }

    const deliveredByPhase = new Map<string, number>();
    for (const segment of intended) {
      segments.push({
        sprintId: segment.sprintId,
        engineerId: segment.engineerId,
        phaseId: segment.phaseId,
        projectId: segment.projectId,
        days: segment.days,
        allocatedFraction: segment.allocatedFraction,
        requestedFraction: segment.requestedFraction,
        unfilled: segment.days <= EPSILON,
      });
      if (segment.days > EPSILON) {
        deliveredByPhase.set(
          segment.phaseId,
          (deliveredByPhase.get(segment.phaseId) ?? 0) + segment.days,
        );
      }
    }
    for (const [phaseId, delivered] of deliveredByPhase) {
      remaining.set(phaseId, Math.max(0, (remaining.get(phaseId) ?? 0) - delivered));
      if (!firstDelivery.has(phaseId)) firstDelivery.set(phaseId, sprint.id);
      lastDelivery.set(phaseId, sprint.id);
    }

    for (const engineer of intent.engineers) {
      const draft = loadDrafts.get(engineer.id)!;
      const deliveredDays = intended
        .filter((segment) => segment.engineerId === engineer.id)
        .reduce((sum, segment) => sum + segment.days, 0);
      loads.push({
        ...draft,
        deliveredDays,
        idleDays: Math.max(0, draft.capacityDays - deliveredDays),
        allocatedFractionSum:
          draft.capacityDays > EPSILON ? deliveredDays / draft.capacityDays : 0,
      });
    }
  }

  const phaseTimelines: PhaseTimeline[] = intent.phases.map((phase) => {
    const predecessorId = predecessor.get(phase.id) ?? null;
    const assigned = (assignmentsByPhase.get(phase.id) ?? []).length > 0;
    const unscheduled = phase.effortDays > EPSILON && !assigned;
    const startSprintId = firstDelivery.get(phase.id) ?? null;
    const endSprintId = lastDelivery.get(phase.id) ?? null;
    const predecessorEnd = predecessorId ? lastDelivery.get(predecessorId) : undefined;
    const expectedAbsoluteIndex = predecessorId && phase.parallelOk !== 1
      ? predecessorEnd
        ? (sprintIndex.get(predecessorEnd) ?? planningStartIndex) + 1
        : null
      : planningStartIndex;
    const actualIndex = startSprintId ? sprintIndex.get(startSprintId) ?? null : null;
    const delayed = !unscheduled && assigned && actualIndex !== null && expectedAbsoluteIndex !== null
      ? actualIndex > expectedAbsoluteIndex
      : false;

    let whyStart: string;
    if (unscheduled) {
      whyStart = "Unassigned — sitting in the unscheduled bucket.";
    } else if (!startSprintId) {
      whyStart = predecessorId
        ? `Waiting on ${phaseById.get(predecessorId)?.name ?? "predecessor work"} or higher-priority work.`
        : "Waiting on higher-priority work in the planning horizon.";
    } else if (delayed) {
      const project = projectById.get(phase.projectId)!;
      const assigneeIds = new Set((assignmentsByPhase.get(phase.id) ?? []).map((a) => a.engineerId));
      const blockers = intent.projects
        .filter((candidate) => candidate.priority < project.priority)
        .filter((candidate) =>
          intent.assignments.some((assignment) => {
            const assignedPhase = phaseById.get(assignment.phaseId);
            return assignedPhase?.projectId === candidate.id && assigneeIds.has(assignment.engineerId);
          }),
        )
        .map((candidate) => candidate.name);
      const assignees = [...assigneeIds]
        .map((id) => engineerById.get(id)?.name ?? id)
        .join(", ");
      const expectedSprint = expectedAbsoluteIndex === null
        ? "a later sprint"
        : sprints[expectedAbsoluteIndex]?.name ?? "the next available sprint";
      whyStart = `Queued behind ${blockers.length ? blockers.join(", ") : "higher-priority work"} on ${assignees}. Expected ${expectedSprint}; starts ${sprints[actualIndex!]?.name ?? startSprintId}.`;
    } else if (predecessorId && phase.parallelOk !== 1) {
      const expectedSprint = expectedAbsoluteIndex === null
        ? startSprintId
        : sprints[expectedAbsoluteIndex]?.name ?? startSprintId;
      whyStart = `Starts after ${phaseById.get(predecessorId)?.name ?? "predecessor"} (${sprints.find((s) => s.id === expectedSprint)?.name ?? expectedSprint}).`;
    } else {
      whyStart = `Starts ${sprints.find((sprint) => sprint.id === startSprintId)?.name ?? startSprintId}.`;
    }

    return {
      phaseId: phase.id,
      projectId: phase.projectId,
      startSprintId,
      endSprintId,
      remainingDays: remaining.get(phase.id) ?? phase.effortDays,
      unscheduled,
      delayed,
      predecessorId,
      whyStart,
    };
  });

  const unscheduledTimelines = phaseTimelines.filter((timeline) => timeline.unscheduled);
  const unscheduledAlerts: ScheduleAlert[] = unscheduledTimelines.map((timeline) => {
    const phase = phaseById.get(timeline.phaseId)!;
    const project = projectById.get(timeline.projectId)!;
    return {
      id: `unscheduled:${phase.id}`,
      kind: "unscheduled",
      message: `${project.code} ${project.name} · ${phase.name} has effort and no assignments.`,
      phaseId: phase.id,
      projectId: project.id,
    };
  });
  const hasIdle = loads.some((load) => load.idleDays > EPSILON);
  const idleAlert: ScheduleAlert[] = unscheduledTimelines.length && hasIdle
    ? [{
        id: "idle-with-gap",
        kind: "idle_with_gap",
        message: `${unscheduledTimelines.length} unscheduled phase(s) while someone has slack.`,
      }]
    : [];
  const delayedAlerts: ScheduleAlert[] = phaseTimelines
    .filter((timeline) => timeline.delayed)
    .map((timeline) => {
      const phase = phaseById.get(timeline.phaseId)!;
      const project = projectById.get(timeline.projectId)!;
      return {
        id: `delayed:${phase.id}`,
        kind: "delayed" as const,
        message: `${project.code} ${project.name} · ${phase.name} starts late. ${timeline.whyStart}`,
        phaseId: phase.id,
        projectId: project.id,
      };
    });

  return {
    segments,
    loads,
    phaseTimelines,
    alerts: [...overloadAlerts, ...unscheduledAlerts, ...idleAlert, ...delayedAlerts],
    currentSprintId: currentSprint?.id ?? null,
    planningStartSprintId: currentSprint?.id ?? null,
    planningStartIndex: Math.max(0, planningStartIndex),
  };
}
