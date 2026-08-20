# Sprint planner

A local sprint board for engineering and project managers. Keep the plan in SQLite, then use your own coding agent (Codex, Claude, Cursor, or similar) to adjust it: move someone onto a project, add time off, split a phase, change priority. The board recomputes who is busy and when work ends.

The app is a view, not a Gantt editor. You or the agent change rows in `data/planner.sqlite`; the timeline lays out from today forward and reloads when the file changes.

Planner behaviour and product decisions are documented in [`docs/`](docs/README.md), including [scheduling and queuing](docs/scheduling-and-queuing.md).

## Run

```bash
npm install
npm run db:init   # recreate data/planner.sqlite from schema + seed
npm run dev       # http://localhost:3000
npm test          # scheduler tests
```

- `/` — chooser
- `/cursor` — working board (Team + Projects lenses)
- `/codex` — placeholder for a second implementation against the same DB

Needs Node and a machine that can compile `better-sqlite3` (normal on macOS/Linux). Override the database path with `PLANNER_DB` if you want.

## What lives in SQLite

Schema: [`data/schema.sql`](data/schema.sql). Units: person-days; 1 week = 5 days; a default sprint is 10 working days.

| Table | Intent |
| --- | --- |
| `engineers` | People and FTE |
| `sprints` | Named 2-week buckets with dates |
| `projects` | Initiatives with a short `code` (`Chk`, or an emoji like `🧠`) and priority (1 wins) |
| `phases` | Ordered work on a project (`effort_days`, optional `parallel_ok`) |
| `assignments` | Who works a phase, at what fraction of capacity |
| `time_off` | Days out in a given sprint |

Do not insert Gantt cells. The scheduler fills those.

The seed (`data/seed.sql`) is a five-person plan starting at sprint **S17** (18 Aug 2026): Checkout, Payments, Atlas mobile. It includes split staffing, PTO, slack, an unscheduled frontend, and a BA without assignments.

## Change the plan

Copy slugs from the inspector (`eng_maya`, `phase_checkout_be`, …), then `INSERT` / `UPDATE` / `DELETE` in the sqlite file. The board watches `data/` over SSE (`/api/watch`) and flashes **Plan updated**.

Reset to seed: `npm run db:init`.

Worked SQL examples: [`AGENT.md`](AGENT.md).

## How the schedule is computed

From the current sprint onward, eligible phases claim capacity in project-priority order. Sequential phases start the sprint after the predecessor finishes. Leftover days in a sprint pour into the next eligible assignment instead of sitting idle. Overload is effective demand over 1.0, not raw fraction sums.

The scheduler lives next to the board (`app/cursor/_lib/schedule.ts`), not in shared `lib/`. Shared pieces are the DB (`lib/db.ts`), schema, watch API, and UI kit.

## Stack

Next.js 16 (App Router), React 19, SQLite via better-sqlite3 + Drizzle, Tailwind + shadcn, Vitest.
