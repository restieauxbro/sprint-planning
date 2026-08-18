# Editing the sprint plan (SQLite)

The Next.js app is a **view**. You change the plan by writing to `data/planner.sqlite`. The board at `/cursor` (and `/codex`) recomputes the timeline and refreshes within a second.

Schema: [`data/schema.sql`](data/schema.sql). Reset seed: `npm run db:init`.

## Units

- `effort_days` is person-days. **1 person-week = 5 days**.
- A default sprint is **10 working days**. FTE `1.0` = 10 person-days per sprint.
- `fraction` is 0–1 of that engineer’s capacity while the phase is eligible.
- `priority` on projects: **1 wins** when two eligible phases want the same person.

## Tables

| Table | What to put there |
| --- | --- |
| `engineers` | People. `id` is a slug (`eng_maya`). `title` is shown on the Team page (Engineer, BA, …). |
| `sprints` | Named 2-week buckets. Dates are `YYYY-MM-DD`. |
| `projects` | Initiatives. `code` is a short label on bars (`Chk`, or an emoji like `🧠`). Lower `priority` number claims capacity first. |
| `phases` | Ordered work on a project. `parallel_ok=1` can overlap the previous phase. |
| `assignments` | Who works a phase, at what fraction. Not a cell per sprint. |
| `time_off` | Days out in a given sprint. Shrinks that person’s capacity. |

Do **not** insert Gantt bars. The scheduler fills sprints from “today” forward.

## Worked examples

### Split a phase across two people (shortens it)

Backend is 30 person-days. Maya alone at 100% is 3 sprints. Add Julian at 50%:

```sql
INSERT INTO assignments (phase_id, engineer_id, fraction)
VALUES ('phase_checkout_be', 'eng_julian', 0.5)
ON CONFLICT (phase_id, engineer_id) DO UPDATE SET fraction = excluded.fraction;
```

15 person-days land per sprint → about 2 sprints.

### Add a project onto a busy engineer (push-out)

Payments discovery on Maya at 50% while she is 100% on Checkout (priority 1):

```sql
INSERT INTO projects (id, name, code, priority, sort_order)
VALUES ('proj_payments', 'Payments', 'Pay', 2, 2);

INSERT INTO phases (id, project_id, name, kind, sort_order, effort_days, parallel_ok)
VALUES ('phase_payments_disc', 'proj_payments', 'Discovery', 'discovery', 1, 10, 0);

INSERT INTO assignments (phase_id, engineer_id, fraction)
VALUES ('phase_payments_disc', 'eng_maya', 0.5);
```

Checkout keeps Maya. Payments waits. Copy `eng_priya` from the inspector and reassign to give it to someone idle:

```sql
INSERT INTO assignments (phase_id, engineer_id, fraction)
VALUES ('phase_payments_disc', 'eng_priya', 1.0);

DELETE FROM assignments
WHERE phase_id = 'phase_payments_disc' AND engineer_id = 'eng_maya';
```

## Talking to the app

The inspector copies slugs (`proj_checkout`, `phase_checkout_be`, `eng_maya`). Paste those ids into SQL. After you commit, the board flashes **Plan updated**.
