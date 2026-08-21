---
name: edit-sprint-plan
description: Modify the sprint planner's live SQLite plan intent when a user asks to change people, projects, phases, dependencies, assignments, allocations, effort, priority, tags, sprints, planned starts, or time off. Use for plan-data mutations, not for application code/schema development, read-only schedule explanations, or saved-view UI configuration.
---

# Edit the sprint plan

Translate the user's planning request into the smallest correct mutation of `data/planner.sqlite` (or `$PLANNER_DB`). The database stores intent; the scheduler calculates timeline bars from dependencies, capacity, time off, allocation fractions, and project priority.

Do not write Gantt cells or manually place calculated work.

## Route the request

| User intent | Source of truth | Important behavior |
| --- | --- | --- |
| Add, rename, tag, or change availability for a person | `engineers` | `fte` scales sprint capacity. Preserve stable `eng_*` IDs when only the display name changes. |
| Add, rename, tag, recolor, reprioritize, or remove a project | `projects` | Lower `priority` claims contended capacity first. Project deletion cascades through its phases. |
| Add, rename, resize, categorize, reorder, schedule, or remove a phase | `phases` | `effort_days` is person-days. `sort_order` is display/tie-break order only. `start_sprint_id` is a lower bound, not a fixed bar position. |
| Make work sequential, start together, branch, or join | `phase_dependencies` | Use explicit `finish_to_start` and `start_together` relationships. Never infer scheduling dependencies from row order. |
| Assign, reassign, split, add, or remove people from a phase | `assignments` | `fraction` is 0–1 of that person's available capacity while eligible. Multiple people shorten a phase by delivering effort together. |
| Add, change, or remove leave | `time_off` | Leave reduces capacity for one sprint. `placement` is `start` or `end`. |
| Add or change a sprint | `sprints` | Dates determine ordering; `working_days` determines capacity. |
| Change a saved/default board view | Application view manager / `saved_views` | This is configuration, not plan intent. Do not hand-edit view JSON unless the user explicitly asks for a database-level repair. |
| Change how the planner behaves or add a new data capability | Application code and schema | This is development work, not an ordinary plan edit. Do not mutate the live plan merely to simulate the feature. |

For exact columns and constraints, read [`data/schema.sql`](../../../data/schema.sql). For mutation recipes, read [references/operations.md](references/operations.md). For dependency requests, also read [`docs/phase-dependencies.md`](../../../docs/phase-dependencies.md). For scheduling consequences, read [`docs/scheduling-and-queuing.md`](../../../docs/scheduling-and-queuing.md).

## Required workflow

1. **Resolve scope and IDs.** Query the relevant people, projects, phases, assignments, dependencies, sprints, and time off. Use stable slugs copied from the inspector when provided. Ask only when different interpretations would materially change ownership, dependency structure, timing, or destructive scope.
2. **Inspect the baseline.** Run `npm run plan:impact`. Run the capacity report for every directly or transitively affected engineer. A dependency, priority, phase-size, sprint, or project change can affect downstream people who were not named by the user.
3. **Model intent, not desired bars.** Choose assignments, fractions, dependencies, effort, priority, time off, and optional planned-start lower bounds that express the request. Do not reverse-engineer fixed sprint cells.
4. **Write transactionally.** Enable foreign keys. Use a transaction for multi-row changes, reassignment, dependency replacement, renames that change IDs, or any destructive edit.
5. **Verify the write.** Select the exact affected rows and run `PRAGMA foreign_key_check`. Confirm dependency direction and all assignment fractions.
6. **Recalculate impact.** Run `npm run plan:impact` again and repeat capacity reports for affected engineers. Compare start/finish changes, overloads, idle time, time off, queued work, and unscheduled phases with the baseline.
7. **Snapshot successful live edits.** Run `npm run plan:snapshot`. The snapshot is the durable, reviewable representation of the internal live plan.
8. **Report the outcome.** State what changed, the calculated schedule effect, any new or changed overage/idle consequence, and any remaining ambiguity. If a destructive write occurred, state what was removed and how it can be recovered.

Use the capacity helper for one person or the full roster:

```bash
npx tsx .agents/skills/edit-sprint-plan/scripts/plan-capacity.ts eng_maya
npx tsx .agents/skills/edit-sprint-plan/scripts/plan-capacity.ts --all
```

## Scheduling rules that change decisions

- **Effort:** `effort_days` is total person-days. One person-week is 5 days.
- **Capacity:** default sprint capacity is `fte × working_days`, reduced by time off.
- **Allocation:** `fraction` requests a share of a person's available capacity; it is not a fixed number of days.
- **Priority:** lower project priority numbers win when eligible work competes for the same person.
- **Finish to start:** a successor becomes eligible in the sprint after every predecessor finishes.
- **Start together:** every active member must receive positive work in the same first sprint. Members then finish independently, and downstream phases may depend on either branch.
- **Planned start:** `start_sprint_id` delays eligibility but cannot override unfinished dependencies or unavailable capacity.
- **Unrelated phases:** phases without a dependency may overlap or start independently.
- **Display order:** `sort_order` changes presentation and same-priority tie-breaking; it does not create a dependency.

## Safety and persistence

- Treat project, phase, engineer, sprint, and dependency deletion as potentially cascading. Inspect child rows and exact counts before deleting; obtain clarification when the user's request does not clearly authorize the cascade.
- Never run `npm run db:init` for an ordinary edit. It destroys the live database and replaces it with demo seed data.
- Do not update `data/seed.sql` for a live company-plan edit unless the user explicitly asks to change the demo/reset plan.
- Do not change `data/schema.sql` unless the user explicitly requests a new application capability or schema migration.
- Do not commit, push, publish, or sync merely because the live plan was edited. Those actions require a separate explicit request and the publishing skill.
- Keep `planner.sqlite`, WAL, and SHM files untracked. After successful live edits, refresh `data/planner.snapshot.sql` with `npm run plan:snapshot`.
- Never push internal plan data to the public GitHub remote. Internal/public publishing is governed by the repository's publishing skill.

## Completion checks

Before handing off, confirm:

- the requested intent is present in SQLite;
- `PRAGMA foreign_key_check` returns no rows;
- the scheduler completes successfully;
- affected capacity was reviewed before and after;
- new or changed overloads are resolved or explicitly reported;
- avoidable idle time introduced by the edit was considered;
- `data/planner.snapshot.sql` reflects the successful live edit.
