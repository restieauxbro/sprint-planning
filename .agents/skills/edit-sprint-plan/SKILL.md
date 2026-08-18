---
name: edit-sprint-plan
description: Edits the sprint planner SQLite source of truth (data/planner.sqlite) with INSERT, UPDATE, and DELETE. Use when the user asks to change the plan, move someone onto a project, add or remove time off, split a phase, change priority, assign people, add a project or engineer, or otherwise update SQLite.
---

# Edit the sprint plan

The Next.js app is a **view**. Change the plan by writing rows in `data/planner.sqlite` (or `$PLANNER_DB`). The board at `/cursor` and `/codex` recomputes the timeline and flashes **Plan updated**.

Do **not** insert Gantt cells. The scheduler fills sprints from today forward.

## Workflow

1. **Look up ids** in SQLite (or copy slugs from the inspector: `eng_maya`, `phase_checkout_be`, `proj_checkout`, `2026-S17`).
2. **Write** `INSERT` / `UPDATE` / `DELETE` against the live DB. Enable foreign keys.
3. **Check schedule impact** with `npm run plan:impact`. Review every new or changed overage with the user; adjust assignments or explicitly flag the impact before handoff.
4. **Verify** the written rows with a `SELECT`. Do not run `npm run db:init` unless the user wants a full seed reset (destructive).
5. If they want the change to survive `db:init`, also update [`data/seed.sql`](../../../data/seed.sql). Default is live DB only.

```bash
DB="${PLANNER_DB:-data/planner.sqlite}"
sqlite3 -header -column "$DB" "PRAGMA foreign_keys = ON; SELECT id, name, title, fte FROM engineers ORDER BY sort_order;"
```

Apply changes with a heredoc:

```bash
DB="${PLANNER_DB:-data/planner.sqlite}"
sqlite3 "$DB" <<'SQL'
PRAGMA foreign_keys = ON;
-- statements
SQL
```

Inspect the computed timeline after every plan write:

```bash
npm run plan:impact
```

It reports the engineer, sprint, requested versus allocated capacity, and each active request contributing to an overage. This uses the same scheduler as the board; a SQL `SELECT` alone cannot reveal timeline conflicts.

Schema: [`data/schema.sql`](../../../data/schema.sql). Extra worked examples: [`AGENT.md`](../../../AGENT.md).

## Units

- `effort_days` is person-days. **1 person-week = 5 days**.
- A default sprint is **10 working days**. FTE `1.0` = 10 person-days per sprint.
- `fraction` is 0–1 of that engineer’s capacity while the phase is eligible.
- Project `priority`: **1 wins** when two eligible phases want the same person.

## Tables

| Table | Write this |
| --- | --- |
| `engineers` | People. `id` slug (`eng_maya`). `title` is Engineer, BA, … |
| `sprints` | Named 2-week buckets. Dates `YYYY-MM-DD`. |
| `projects` | Initiatives. `code` is the short bar label (`Chk`, or an emoji). Lower `priority` claims capacity first. |
| `phases` | Ordered work on a project. `parallel_ok=1` may overlap the previous phase. |
| `assignments` | Who works a phase, at what fraction. Not a cell per sprint. |
| `time_off` | Days out in a given sprint. Shrinks that person’s capacity. |

## Lookup queries

```sql
SELECT id, name, title, fte FROM engineers ORDER BY sort_order;
SELECT id, name, start_date, end_date FROM sprints ORDER BY start_date;
SELECT id, name, code, priority FROM projects ORDER BY sort_order;
SELECT id, project_id, name, kind, effort_days, parallel_ok FROM phases ORDER BY project_id, sort_order;
SELECT phase_id, engineer_id, fraction FROM assignments;
SELECT engineer_id, sprint_id, days_off FROM time_off;
```

## Common edits

### Assign or reassign someone

```sql
INSERT INTO assignments (phase_id, engineer_id, fraction)
VALUES ('phase_payments_disc', 'eng_priya', 1.0)
ON CONFLICT (phase_id, engineer_id) DO UPDATE SET fraction = excluded.fraction;

DELETE FROM assignments
WHERE phase_id = 'phase_payments_disc' AND engineer_id = 'eng_maya';
```

### Split a phase across two people (shortens it)

Backend is 30 person-days. Maya alone at 100% is 3 sprints. Add Julian at 50%:

```sql
INSERT INTO assignments (phase_id, engineer_id, fraction)
VALUES ('phase_checkout_be', 'eng_julian', 0.5)
ON CONFLICT (phase_id, engineer_id) DO UPDATE SET fraction = excluded.fraction;
```

### Add a project and first phase

```sql
INSERT INTO projects (id, name, code, priority, sort_order)
VALUES ('proj_payments', 'Payments', 'Pay', 2, 2);

INSERT INTO phases (id, project_id, name, kind, sort_order, effort_days, parallel_ok)
VALUES ('phase_payments_disc', 'proj_payments', 'Discovery', 'discovery', 1, 10, 0);

INSERT INTO assignments (phase_id, engineer_id, fraction)
VALUES ('phase_payments_disc', 'eng_maya', 0.5);
```

Lower-priority work waits if the person is already claimed by priority 1.

### Time off

```sql
INSERT INTO time_off (engineer_id, sprint_id, days_off)
VALUES ('eng_julian', '2026-S19', 2)
ON CONFLICT (engineer_id, sprint_id) DO UPDATE SET days_off = excluded.days_off;
```

### Change size, priority, or overlap

```sql
UPDATE phases SET effort_days = 20 WHERE id = 'phase_checkout_be';
UPDATE projects SET priority = 1 WHERE id = 'proj_atlas';
UPDATE phases SET parallel_ok = 1 WHERE id = 'phase_checkout_fe';
```

New ids: `eng_*`, `proj_*`, `phase_*`, sprint ids like `2026-S17`. Keep them stable slugs, not display names.

## Do not

- Insert computed timeline / Gantt rows (there is no such table).
- Change [`data/schema.sql`](../../../data/schema.sql) unless the user asked for a schema change.
- Use the Team page roster helpers (`addEngineer` / `renameEngineer`) for plan edits; those are UI-only. Plan changes go through `sqlite3`.
