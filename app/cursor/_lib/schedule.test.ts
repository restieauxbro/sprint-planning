import { describe, expect, it } from "vitest";
import type { ScheduleIntent } from "@/lib/schema";
import { schedule } from "./schedule";

const sprints = [
  sprint("s1", "2026-01-05", "2026-01-16"),
  sprint("s2", "2026-01-19", "2026-01-30"),
  sprint("s3", "2026-02-02", "2026-02-13"),
  sprint("s4", "2026-02-16", "2026-02-27"),
];

function sprint(id: string, startDate: string, endDate: string) {
  return { id, name: id.toUpperCase(), startDate, endDate, workingDays: 10 };
}

function baseIntent(overrides: Partial<ScheduleIntent> = {}): ScheduleIntent {
  return {
    engineers: [{ id: "eng_a", name: "Alice", title: "Engineer", fte: 1, sortOrder: 1 }],
    sprints,
    projects: [{ id: "proj_a", name: "A", code: "Aaa", priority: 1, sortOrder: 1 }],
    phases: [],
    phaseDependencies: [],
    assignments: [],
    timeOff: [],
    ...overrides,
  };
}

describe("schedule", () => {
  it("runs sequential phases finish-to-start across sprints", () => {
    const result = schedule(
      baseIntent({
        phases: [
          {
            id: "p1",
            projectId: "proj_a",
            name: "Discovery",
            kind: "discovery",
            sortOrder: 1,
            effortDays: 10,
          },
          {
            id: "p2",
            projectId: "proj_a",
            name: "Build",
            kind: "backend",
            sortOrder: 2,
            effortDays: 10,
          },
        ],
        assignments: [
          { phaseId: "p1", engineerId: "eng_a", fraction: 1 },
          { phaseId: "p2", engineerId: "eng_a", fraction: 1 },
        ],
        phaseDependencies: [
          {
            predecessorPhaseId: "p1",
            successorPhaseId: "p2",
            dependencyType: "finish_to_start",
          },
        ],
      }),
      "2026-01-06",
    );

    const p1 = result.phaseTimelines.find((p) => p.phaseId === "p1")!;
    const p2 = result.phaseTimelines.find((p) => p.phaseId === "p2")!;
    expect(p1.startSprintId).toBe("s1");
    expect(p1.endSprintId).toBe("s1");
    expect(p2.startSprintId).toBe("s2");
    expect(p2.endSprintId).toBe("s2");
  });

  it("starts grouped phases together, lets them finish independently, and follows each branch", () => {
    const result = schedule(
      baseIntent({
        engineers: [
          { id: "eng_a", name: "Alice", title: "Engineer", fte: 1, sortOrder: 1 },
          { id: "eng_b", name: "Bob", title: "Engineer", fte: 1, sortOrder: 2 },
        ],
        phases: [
          {
            id: "discovery",
            projectId: "proj_a",
            name: "Discovery",
            kind: "discovery",
            sortOrder: 1,
            effortDays: 10,
          },
          {
            id: "build",
            projectId: "proj_a",
            name: "Build",
            kind: "backend",
            sortOrder: 2,
            effortDays: 20,
          },
          {
            id: "data",
            projectId: "proj_a",
            name: "Data build",
            kind: "backend",
            sortOrder: 3,
            effortDays: 5,
          },
          {
            id: "build_followup",
            projectId: "proj_a",
            name: "Build follow-up",
            kind: "other",
            sortOrder: 4,
            effortDays: 10,
          },
          {
            id: "data_followup",
            projectId: "proj_a",
            name: "Data follow-up",
            kind: "other",
            sortOrder: 5,
            effortDays: 10,
          },
        ],
        phaseDependencies: [
          {
            predecessorPhaseId: "discovery",
            successorPhaseId: "build",
            dependencyType: "finish_to_start",
          },
          {
            predecessorPhaseId: "build",
            successorPhaseId: "data",
            dependencyType: "start_together",
          },
          {
            predecessorPhaseId: "build",
            successorPhaseId: "build_followup",
            dependencyType: "finish_to_start",
          },
          {
            predecessorPhaseId: "data",
            successorPhaseId: "data_followup",
            dependencyType: "finish_to_start",
          },
        ],
        assignments: [
          { phaseId: "discovery", engineerId: "eng_a", fraction: 1 },
          { phaseId: "build", engineerId: "eng_a", fraction: 1 },
          { phaseId: "data", engineerId: "eng_b", fraction: 0.5 },
          { phaseId: "build_followup", engineerId: "eng_a", fraction: 1 },
          { phaseId: "data_followup", engineerId: "eng_b", fraction: 1 },
        ],
      }),
      "2026-01-06",
    );

    const timeline = new Map(result.phaseTimelines.map((phase) => [phase.phaseId, phase]));
    expect(timeline.get("build")?.startSprintId).toBe("s2");
    expect(timeline.get("data")?.startSprintId).toBe("s2");
    expect(timeline.get("data")?.endSprintId).toBe("s2");
    expect(timeline.get("build")?.endSprintId).toBe("s3");
    expect(timeline.get("data_followup")?.startSprintId).toBe("s3");
    expect(timeline.get("build_followup")?.startSprintId).toBe("s4");
  });

  it("holds a start-together group until every phase can receive work", () => {
    const result = schedule(
      baseIntent({
        engineers: [
          { id: "eng_a", name: "Alice", title: "Engineer", fte: 1, sortOrder: 1 },
          { id: "eng_b", name: "Bob", title: "Engineer", fte: 1, sortOrder: 2 },
        ],
        phases: [
          {
            id: "build",
            projectId: "proj_a",
            name: "Build",
            kind: "backend",
            sortOrder: 1,
            effortDays: 10,
          },
          {
            id: "data",
            projectId: "proj_a",
            name: "Data build",
            kind: "backend",
            sortOrder: 2,
            effortDays: 10,
          },
        ],
        phaseDependencies: [
          {
            predecessorPhaseId: "build",
            successorPhaseId: "data",
            dependencyType: "start_together",
          },
        ],
        assignments: [
          { phaseId: "build", engineerId: "eng_a", fraction: 1 },
          { phaseId: "data", engineerId: "eng_b", fraction: 1 },
        ],
        timeOff: [
          { engineerId: "eng_b", sprintId: "s1", daysOff: 10, placement: "start" },
        ],
      }),
      "2026-01-06",
    );

    expect(result.phaseTimelines.find((phase) => phase.phaseId === "build")?.startSprintId).toBe(
      "s2",
    );
    expect(result.phaseTimelines.find((phase) => phase.phaseId === "data")?.startSprintId).toBe(
      "s2",
    );
  });

  it("does not request capacity before an explicit start sprint", () => {
    const result = schedule(
      baseIntent({
        phases: [
          {
            id: "planned",
            projectId: "proj_a",
            name: "Planned discovery",
            kind: "discovery",
            sortOrder: 1,
            effortDays: 10,
            startSprintId: "s3",
          },
        ],
        assignments: [{ phaseId: "planned", engineerId: "eng_a", fraction: 0.5 }],
      }),
      "2026-01-06",
    );

    expect(result.loads.find((load) => load.sprintId === "s1")?.requestedFractionSum).toBe(0);
    expect(result.loads.find((load) => load.sprintId === "s2")?.requestedFractionSum).toBe(0);
    expect(result.phaseTimelines[0]?.startSprintId).toBe("s3");
    expect(result.phaseTimelines[0]?.delayed).toBe(false);
    expect(result.phaseTimelines[0]?.whyStart).toBe("Scheduled for S3.");
  });

  it("shortens a phase when a second engineer joins", () => {
    const solo = schedule(
      baseIntent({
        phases: [
          {
            id: "be",
            projectId: "proj_a",
            name: "Backend",
            kind: "backend",
            sortOrder: 1,
            effortDays: 30,
          },
        ],
        assignments: [{ phaseId: "be", engineerId: "eng_a", fraction: 1 }],
      }),
      "2026-01-06",
    );

    const split = schedule(
      baseIntent({
        engineers: [
          { id: "eng_a", name: "Alice", title: "Engineer", fte: 1, sortOrder: 1 },
          { id: "eng_b", name: "Bob", title: "Engineer", fte: 1, sortOrder: 2 },
        ],
        phases: [
          {
            id: "be",
            projectId: "proj_a",
            name: "Backend",
            kind: "backend",
            sortOrder: 1,
            effortDays: 30,
          },
        ],
        assignments: [
          { phaseId: "be", engineerId: "eng_a", fraction: 1 },
          { phaseId: "be", engineerId: "eng_b", fraction: 0.5 },
        ],
      }),
      "2026-01-06",
    );

    expect(solo.phaseTimelines[0]?.endSprintId).toBe("s3");
    expect(split.phaseTimelines[0]?.endSprintId).toBe("s2");
  });

  it("lets priority 1 keep capacity so a new project waits", () => {
    const result = schedule(
      baseIntent({
        projects: [
          { id: "proj_a", name: "A", code: "Aaa", priority: 1, sortOrder: 1 },
          { id: "proj_b", name: "B", code: "Bee", priority: 2, sortOrder: 2 },
        ],
        phases: [
          {
            id: "a1",
            projectId: "proj_a",
            name: "A work",
            kind: "backend",
            sortOrder: 1,
            effortDays: 20,
          },
          {
            id: "b1",
            projectId: "proj_b",
            name: "B work",
            kind: "discovery",
            sortOrder: 1,
            effortDays: 10,
          },
        ],
        assignments: [
          { phaseId: "a1", engineerId: "eng_a", fraction: 1 },
          { phaseId: "b1", engineerId: "eng_a", fraction: 0.5 },
        ],
      }),
      "2026-01-06",
    );

    const a = result.phaseTimelines.find((p) => p.phaseId === "a1")!;
    const b = result.phaseTimelines.find((p) => p.phaseId === "b1")!;
    expect(a.startSprintId).toBe("s1");
    expect(a.endSprintId).toBe("s2");
    expect(b.startSprintId).toBe("s3");
    expect(result.loads.filter((l) => l.engineerId === "eng_a" && l.overloaded).length).toBeGreaterThan(
      0,
    );
    expect(b.delayed).toBe(true);
    const queued = result.segments.filter(
      (s) => s.phaseId === "b1" && s.unfilled && s.sprintId === "s1",
    );
    expect(queued).toHaveLength(1);
    expect(queued[0]?.requestedFraction).toBe(0.5);
  });

  it("pours leftover days into the next eligible assignment instead of idling", () => {
    const result = schedule(
      baseIntent({
        projects: [
          { id: "proj_a", name: "A", code: "Aaa", priority: 1, sortOrder: 1 },
          { id: "proj_b", name: "B", code: "Bee", priority: 2, sortOrder: 2 },
        ],
        phases: [
          {
            id: "a1",
            projectId: "proj_a",
            name: "A work",
            kind: "discovery",
            sortOrder: 1,
            effortDays: 5,
          },
          {
            id: "b1",
            projectId: "proj_b",
            name: "B work",
            kind: "discovery",
            sortOrder: 1,
            effortDays: 10,
          },
        ],
        assignments: [
          { phaseId: "a1", engineerId: "eng_a", fraction: 1 },
          { phaseId: "b1", engineerId: "eng_a", fraction: 0.5 },
        ],
      }),
      "2026-01-06",
    );

    const s1 = result.loads.find((l) => l.engineerId === "eng_a" && l.sprintId === "s1")!;
    expect(s1.overloaded).toBe(false);
    expect(s1.idleDays).toBeLessThan(0.05);
    expect(
      result.segments.filter((s) => s.sprintId === "s1").map((s) => s.phaseId).sort(),
    ).toEqual(["a1", "b1"]);
    expect(result.phaseTimelines.find((p) => p.phaseId === "b1")?.startSprintId).toBe("s1");
  });

  it("marks phases with effort and no people as unscheduled", () => {
    const result = schedule(
      baseIntent({
        phases: [
          {
            id: "orphan",
            projectId: "proj_a",
            name: "Frontend",
            kind: "frontend",
            sortOrder: 1,
            effortDays: 15,
          },
        ],
      }),
      "2026-01-06",
    );
    expect(result.phaseTimelines[0]?.unscheduled).toBe(true);
    expect(result.alerts.some((a) => a.kind === "unscheduled")).toBe(true);
  });
});
