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
            parallelOk: 0,
          },
          {
            id: "p2",
            projectId: "proj_a",
            name: "Build",
            kind: "backend",
            sortOrder: 2,
            effortDays: 10,
            parallelOk: 0,
          },
        ],
        assignments: [
          { phaseId: "p1", engineerId: "eng_a", fraction: 1 },
          { phaseId: "p2", engineerId: "eng_a", fraction: 1 },
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
            parallelOk: 0,
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
            parallelOk: 0,
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
            parallelOk: 0,
          },
          {
            id: "b1",
            projectId: "proj_b",
            name: "B work",
            kind: "discovery",
            sortOrder: 1,
            effortDays: 10,
            parallelOk: 0,
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
            parallelOk: 0,
          },
          {
            id: "b1",
            projectId: "proj_b",
            name: "B work",
            kind: "discovery",
            sortOrder: 1,
            effortDays: 10,
            parallelOk: 0,
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
            parallelOk: 0,
          },
        ],
      }),
      "2026-01-06",
    );
    expect(result.phaseTimelines[0]?.unscheduled).toBe(true);
    expect(result.alerts.some((a) => a.kind === "unscheduled")).toBe(true);
  });
});
