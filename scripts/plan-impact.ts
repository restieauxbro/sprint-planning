import { loadIntent } from "../lib/db";
import { schedule } from "../app/cursor/_lib/schedule";

const loaded = loadIntent();

if (!loaded.ok) {
  console.error(`Cannot inspect the plan: ${loaded.message}`);
  process.exitCode = 1;
} else {
  const result = schedule(loaded.intent);
  const engineers = new Map(loaded.intent.engineers.map((engineer) => [engineer.id, engineer.name]));
  const sprints = new Map(loaded.intent.sprints.map((sprint) => [sprint.id, sprint.name]));
  const projects = new Map(loaded.intent.projects.map((project) => [project.id, project.name]));
  const phases = new Map(loaded.intent.phases.map((phase) => [phase.id, phase.name]));
  const overloaded = result.loads.filter((load) => load.overloaded);

  if (overloaded.length === 0) {
    console.log("No capacity overrages in the scheduled horizon.");
  } else {
    console.table(
      overloaded.map((load) => {
        const requests = result.segments
          .filter(
            (segment) =>
              segment.engineerId === load.engineerId && segment.sprintId === load.sprintId,
          )
          .map(
            (segment) =>
              `${projects.get(segment.projectId)} · ${phases.get(segment.phaseId)} ${Math.round(segment.requestedFraction * 100)}%`,
          )
          .join(" | ");

        return {
          engineer: engineers.get(load.engineerId),
          sprint: sprints.get(load.sprintId),
          requested: `${Math.round(load.requestedFractionSum * 100)}%`,
          allocated: `${Math.round(load.allocatedFractionSum * 100)}%`,
          requests,
        };
      }),
    );
  }
}
