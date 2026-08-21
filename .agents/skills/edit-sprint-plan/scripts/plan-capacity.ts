import { loadIntent } from "../../../../lib/db";
import { schedule } from "../../../../app/cursor/_lib/schedule";

const query = process.argv[2]?.trim();

if (!query) {
  console.error(
    "Usage: npx tsx .agents/skills/edit-sprint-plan/scripts/plan-capacity.ts <engineer-id-or-name|--all>",
  );
  process.exit(1);
}

const loaded = loadIntent();
if (!loaded.ok) {
  console.error(loaded.message);
  process.exit(1);
}

const selectedEngineers =
  query === "--all"
    ? loaded.intent.engineers
    : loaded.intent.engineers.filter(
        (candidate) =>
          candidate.id === query ||
          candidate.name.toLocaleLowerCase() === query.toLocaleLowerCase(),
      );

if (!selectedEngineers.length) {
  console.error(`Engineer not found: ${query}`);
  process.exit(1);
}

const result = schedule(loaded.intent);
const sprintNames = new Map(loaded.intent.sprints.map((sprint) => [sprint.id, sprint.name]));
const projectNames = new Map(loaded.intent.projects.map((project) => [project.id, project.name]));
const phaseNames = new Map(loaded.intent.phases.map((phase) => [phase.id, phase.name]));

for (const engineer of selectedEngineers) {
  console.log(`${engineer.name} · ${engineer.fte.toFixed(1)} FTE`);
  console.table(
    result.loads
      .filter((load) => load.engineerId === engineer.id)
      .map((load) => ({
        sprint: sprintNames.get(load.sprintId) ?? load.sprintId,
        requested: `${Math.round(load.requestedFractionSum * 100)}%`,
        allocated: `${Math.round(load.allocatedFractionSum * 100)}%`,
        idle_days: Number(load.idleDays.toFixed(1)),
        time_off_days: Number(load.timeOffDays.toFixed(1)),
        overage: load.overloaded ? "yes" : "",
        work: result.segments
          .filter(
            (segment) =>
              segment.engineerId === engineer.id &&
              segment.sprintId === load.sprintId &&
              segment.days > 0,
          )
          .map(
            (segment) =>
              `${projectNames.get(segment.projectId) ?? segment.projectId} · ${phaseNames.get(segment.phaseId) ?? segment.phaseId} ${Math.round(segment.allocatedFraction * 100)}%`,
          )
          .join(" | "),
      })),
  );
}
