# Sprint-plan mutation recipes

Read this reference when applying a live plan mutation. The authoritative constraints remain in [`data/schema.sql`](../../../../data/schema.sql).

## Connect safely

```bash
planner_db="${PLANNER_DB:-data/planner.sqlite}"
sqlite3 -header -column "$planner_db" "PRAGMA foreign_keys = ON; PRAGMA foreign_key_check;"
```

Apply multi-row changes with a transaction:

```bash
planner_db="${PLANNER_DB:-data/planner.sqlite}"
sqlite3 "$planner_db" <<'SQL'
PRAGMA foreign_keys = ON;
BEGIN IMMEDIATE;
-- statements
COMMIT;
SQL
```

## Look up plan intent

```sql
SELECT id, name, title, fte, tags, sort_order
FROM engineers ORDER BY sort_order;

SELECT id, name, start_date, end_date, working_days
FROM sprints ORDER BY start_date;

SELECT id, name, code, color, priority, tags, sort_order
FROM projects ORDER BY sort_order;

SELECT id, project_id, name, kind, sort_order, effort_days, start_sprint_id
FROM phases ORDER BY project_id, sort_order;

SELECT predecessor_phase_id, successor_phase_id, dependency_type
FROM phase_dependencies
ORDER BY predecessor_phase_id, successor_phase_id;

SELECT phase_id, engineer_id, fraction
FROM assignments ORDER BY phase_id, engineer_id;

SELECT engineer_id, sprint_id, days_off, placement
FROM time_off ORDER BY engineer_id, sprint_id;
```

## People

Add a person with a stable slug and the next display order:

```sql
INSERT INTO engineers (id, name, title, fte, tags, sort_order)
SELECT
  'eng_maya', 'Maya Reed', 'Engineer', 1.0, 'Applications',
  COALESCE(MAX(sort_order), 0) + 1
FROM engineers;
```

Rename the display name without changing references:

```sql
UPDATE engineers SET name = 'Maya Chen' WHERE id = 'eng_maya';
```

Change FTE or comma-separated tags:

```sql
UPDATE engineers SET fte = 0.8 WHERE id = 'eng_maya';
UPDATE engineers SET tags = 'AI Team, Platform' WHERE id = 'eng_maya';
```

Deleting an engineer cascades through assignments and time off. Inspect both tables before an authorized deletion.

## Projects

Add a project:

```sql
INSERT INTO projects (id, name, code, color, priority, tags, sort_order)
SELECT
  'proj_payments', 'Payments', 'Pay', 'teal', 2, 'Launchpad',
  COALESCE(MAX(sort_order), 0) + 1
FROM projects;
```

Update portfolio properties:

```sql
UPDATE projects
SET name = 'Payments Platform',
    code = 'Pay',
    color = 'blue',
    priority = 1,
    tags = 'Launchpad, AI Team'
WHERE id = 'proj_payments';
```

Deleting a project cascades to its phases, which cascade to assignments and dependencies. Inspect the complete project subtree before deleting.

## Phases and effort

Add a phase. Use `start_sprint_id` only when there is an intentional earliest sprint:

```sql
INSERT INTO phases (
  id, project_id, name, kind, sort_order, effort_days, start_sprint_id
) VALUES (
  'phase_payments_discovery',
  'proj_payments',
  'Discovery',
  'discovery',
  1,
  10,
  NULL
);
```

Change size, display order, or earliest start:

```sql
UPDATE phases SET effort_days = 15.5 WHERE id = 'phase_payments_discovery';
UPDATE phases SET sort_order = 2 WHERE id = 'phase_payments_discovery';
UPDATE phases SET start_sprint_id = '2026-S21' WHERE id = 'phase_payments_discovery';
UPDATE phases SET start_sprint_id = NULL WHERE id = 'phase_payments_discovery';
```

Use positive effort for active work. A zero-effort phase is treated as already complete by the scheduler.

Deleting a phase cascades to its assignments and every dependency that references it. Inspect those rows first.

## Dependencies and branches

For the full semantics and modelling rules, read [`docs/phase-dependencies.md`](../../../../docs/phase-dependencies.md).

Add a completion gate:

```sql
INSERT INTO phase_dependencies (
  predecessor_phase_id, successor_phase_id, dependency_type
) VALUES (
  'phase_payments_discovery',
  'phase_payments_build',
  'finish_to_start'
);
```

Make two phases begin atomically but finish independently:

```sql
INSERT INTO phase_dependencies (
  predecessor_phase_id, successor_phase_id, dependency_type
) VALUES (
  'phase_payments_build',
  'phase_payments_data_build',
  'start_together'
);
```

Branch downstream work from either start-group member:

```sql
INSERT INTO phase_dependencies (
  predecessor_phase_id, successor_phase_id, dependency_type
) VALUES
  ('phase_payments_build', 'phase_payments_hypercare', 'finish_to_start'),
  ('phase_payments_data_build', 'phase_payments_data_followup', 'finish_to_start');
```

Replace a relationship in one transaction by deleting the exact old record and inserting the new one. Avoid finish-to-start cycles and finish dependencies between members of the same start group.

## Assignments

Assign or change a person's requested fraction:

```sql
INSERT INTO assignments (phase_id, engineer_id, fraction)
VALUES ('phase_payments_build', 'eng_maya', 0.5)
ON CONFLICT (phase_id, engineer_id)
DO UPDATE SET fraction = excluded.fraction;
```

Reassign atomically:

```sql
BEGIN IMMEDIATE;

DELETE FROM assignments
WHERE phase_id = 'phase_payments_build'
  AND engineer_id = 'eng_maya';

INSERT INTO assignments (phase_id, engineer_id, fraction)
VALUES ('phase_payments_build', 'eng_julian', 0.5);

COMMIT;
```

Multiple assignments deliver effort together. Fractions are per person and do not need to sum to one across a phase. Review each person's other eligible work before increasing a fraction.

## Time off

Add or update leave:

```sql
INSERT INTO time_off (engineer_id, sprint_id, days_off, placement)
VALUES ('eng_maya', '2026-S21', 2, 'start')
ON CONFLICT (engineer_id, sprint_id)
DO UPDATE SET
  days_off = excluded.days_off,
  placement = excluded.placement;
```

Remove leave:

```sql
DELETE FROM time_off
WHERE engineer_id = 'eng_maya'
  AND sprint_id = '2026-S21';
```

Check that leave does not exceed the person's nominal capacity for the sprint unless the user explicitly intends a fully unavailable period.

## Sprints

Add a sprint:

```sql
INSERT INTO sprints (id, name, start_date, end_date, working_days)
VALUES ('2026-S28', 'S28', '2027-01-18', '2027-01-29', 10);
```

Changing sprint dates can reorder the planning horizon. Changing `working_days` changes capacity for everyone in that sprint, so treat either as a broad-impact edit and review the full roster.

Deleting a sprint cascades to time off. It is rejected while a phase still references it through `start_sprint_id`, so inspect and update those references first.

## Verification

After the transaction:

```sql
PRAGMA foreign_key_check;
```

Select the exact affected rows, then run:

```bash
npm run plan:impact
npx tsx .agents/skills/edit-sprint-plan/scripts/plan-capacity.ts eng_maya
npm run plan:snapshot
```

For broad changes, use `plan-capacity.ts --all`.
