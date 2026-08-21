# Decision log

## 2026-08-20 — The timeline is calculated from intent

**Decision:** Store people, sprints, phases, assignments, priorities, and time off in SQLite. Calculate timeline bars rather than storing editable Gantt cells.

**Why:** A change to effort, allocation, leave, or priority should consistently update every affected date and load. It also keeps the database as a concise statement of plan intent.

## 2026-08-20 — Capacity is a hard limit; excess demand queues

**Decision:** Do not allocate more work than an engineer's available sprint capacity. Show competing eligible work as queued when higher-priority work consumes capacity.

**Why:** The plan should show the delivery consequence of over-commitment instead of silently implying that more than 100% can be delivered. Queued work stays visible and is automatically retried in later sprints.

## 2026-08-20 — Project priority resolves contention

**Decision:** Use lower project priority numbers first when eligible phases compete for the same person's capacity.

**Why:** This turns priority into a concrete delivery trade-off: higher-priority work retains capacity and lower-priority work moves out. Phase order resolves ties within a project.

## 2026-08-20 — Projects view shows the capacity-aware forecast

**Decision:** Show calculated start and finish sprints in the Projects view, not an effort-only or requested timeline.

**Why:** A project view should communicate the current forecast. The Team view provides the supporting sprint-by-sprint explanation, including queued and idle capacity.

## 2026-08-21 — Phase dependencies are explicit

**Decision:** Replace implicit row-order sequencing and `parallel_ok` with explicit `finish_to_start` and `start_together` relationships. Treat display order as presentation only.

**Why:** Generic overlap cannot express phases that must move and begin together, finish independently, and release separate downstream branches. Explicit relationships make those constraints durable and allow a phase to have multiple predecessors or successors.

## 2026-08-21 — Start-together groups begin atomically

**Decision:** Do not start any active member of a start-together group until every active member can receive work in the same sprint. After that first sprint, schedule each member independently.

**Why:** Merely making phases eligible together does not guarantee that capacity contention will let them actually begin together. Atomic first delivery preserves the planning constraint without coupling their finish dates.

## 2026-08-21 — No compatibility layer for `parallel_ok`

**Decision:** Remove `parallel_ok` from the phase schema and migrate existing plan intent into dependency records without retaining legacy scheduling behaviour.

**Why:** Maintaining both models would make phase ordering ambiguous. One dependency graph gives the scheduler, database editors, inspector, and documentation a single source of truth.
