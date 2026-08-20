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
