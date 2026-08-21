# Capabilities

## Plan intent

The planner records:

- engineers, their FTE, and time off;
- dated sprints and their working days;
- projects and their priority;
- ordered project phases, their effort in person-days, and dependencies;
- phase assignments, expressed as a share of each person's capacity.

It can model shared work, part-time allocations, explicit sequential gates, atomic start-together groups, independent branches, planned future starts, competing priorities, and unassigned work.

## Capacity-aware scheduling

The planner calculates a delivery schedule from the current sprint onward. It takes account of available capacity, time off, phase dependencies, project priority, and each assignment's requested fraction. It does not store manually positioned timeline bars.

## Views

| View | What it answers |
| --- | --- |
| Team | Who is working on what in each sprint, including requested load, allocated load, idle time, and queued work. |
| Projects | When each phase is expected to start and finish after capacity, priorities, and dependencies have been applied. |
| Inspector | The selected phase's size, assignments, calculated schedule, start group, dependent phases, and reason for its start. |

The effort displayed for a phase is its requested size. Timeline bars in the Projects view represent the calculated, capacity-aware delivery timeline.

## Alerts and states

- **Overloaded** means the total eligible demand on a person exceeds their available capacity for the sprint.
- **Queued** means eligible work requested capacity but received no delivery days because higher-priority work used the available capacity.
- **Idle** means capacity was not used by any delivered work in that sprint.
- **Unscheduled** means a phase has effort but no assignments.
- **Delayed** means an assigned phase began later than its dependency or planned start would otherwise allow.

See [Scheduling and queuing](scheduling-and-queuing.md) for how these states affect delivery dates.

See [Phase dependencies](phase-dependencies.md) for sequential, concurrent, and branching phase relationships.
