import { describe, expect, it } from "vitest";
import type { ScheduleIntent } from "@/lib/schema";
import { schedule } from "./schedule";

const sprints = [1, 2, 3, 4].map((number) => ({
  id: `s${number}`,
  name: `S${number}`,
  startDate: `2026-0${number}-01`,
  endDate: `2026-0${number}-14`,
  workingDays: 10,
}));

function intent(
  projects: ScheduleIntent["projects"],
  phases: ScheduleIntent["phases"],
  assignments: ScheduleIntent["assignments"],
  engineerCount = 1,
): ScheduleIntent {
  return {
    engineers: [
      { id: "alice", name: "Alice Chen", title: "Engineer", fte: 1, sortOrder: 1 },
      { id: "bob", name: "Bob Okonkwo", title: "Engineer", fte: 1, sortOrder: 2 },
    ].slice(0, engineerCount),
    sprints,
    projects,
    phases,
    assignments,
    timeOff: [],
  };
}

const project = (id: string, priority: number) => ({
  id,
  name: id.toUpperCase(),
  code: id,
  priority,
  sortOrder: priority,
});
const phase = (id: string, projectId: string, sortOrder: number, effortDays: number) => ({
  id,
  projectId,
  name: id,
  kind: "build",
  sortOrder,
  effortDays,
  parallelOk: 0,
});
const assignment = (phaseId: string, engineerId: string, fraction: number) => ({
  phaseId,
  engineerId,
  fraction,
});

describe("schedule", () => {
  it("starts a sequential successor in the following sprint", () => {
    const result = schedule(
      intent(
        [project("p1", 1)],
        [phase("one", "p1", 1, 10), phase("two", "p1", 2, 10)],
        [assignment("one", "alice", 1), assignment("two", "alice", 1)],
      ),
      "2026-01-05",
    );
    expect(result.phaseTimelines.find((item) => item.phaseId === "one")?.endSprintId).toBe("s1");
    expect(result.phaseTimelines.find((item) => item.phaseId === "two")?.startSprintId).toBe("s2");
  });

  it("shortens a 30 day phase when a second engineer contributes", () => {
    const single = schedule(
      intent([project("p1", 1)], [phase("work", "p1", 1, 30)], [assignment("work", "alice", 1)]),
      "2026-01-05",
    );
    const split = schedule(
      intent(
        [project("p1", 1)],
        [phase("work", "p1", 1, 30)],
        [assignment("work", "alice", 1), assignment("work", "bob", 0.5)],
        2,
      ),
      "2026-01-05",
    );
    expect(single.phaseTimelines[0].endSprintId).toBe("s3");
    expect(split.phaseTimelines[0].endSprintId).toBe("s2");
  });

  it("queues lower priority demand, exposes it as unfilled, and marks delay", () => {
    const result = schedule(
      intent(
        [project("p1", 1), project("p2", 2)],
        [phase("high", "p1", 1, 20), phase("low", "p2", 1, 10)],
        [assignment("high", "alice", 1), assignment("low", "alice", 0.5)],
      ),
      "2026-01-05",
    );
    const firstLoad = result.loads.find((load) => load.sprintId === "s1")!;
    const queued = result.segments.find(
      (segment) => segment.sprintId === "s1" && segment.phaseId === "low",
    )!;
    expect(firstLoad.overloaded).toBe(true);
    expect(queued).toMatchObject({ unfilled: true, requestedFraction: 0.5, days: 0 });
    expect(result.phaseTimelines.find((item) => item.phaseId === "low")?.delayed).toBe(true);
  });

  it("waterfills leftover capacity without a false overload", () => {
    const result = schedule(
      intent(
        [project("p1", 1), project("p2", 2)],
        [phase("short", "p1", 1, 5), phase("other", "p2", 1, 10)],
        [assignment("short", "alice", 1), assignment("other", "alice", 0.5)],
      ),
      "2026-01-05",
    );
    const first = result.loads.find((load) => load.sprintId === "s1")!;
    expect(first.overloaded).toBe(false);
    expect(first.idleDays).toBeCloseTo(0);
    expect(result.segments.filter((segment) => segment.sprintId === "s1" && segment.days > 0))
      .toHaveLength(2);
  });

  it("puts work with no assignments in the unscheduled bucket", () => {
    const result = schedule(
      intent([project("p1", 1)], [phase("orphan", "p1", 1, 5)], []),
      "2026-01-05",
    );
    expect(result.phaseTimelines[0].unscheduled).toBe(true);
    expect(result.alerts.some((alert) => alert.kind === "unscheduled")).toBe(true);
  });
});
