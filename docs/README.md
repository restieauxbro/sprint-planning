# Sprint planner documentation

This folder explains what the planner can model, how it turns plan intent into a timeline, and the decisions behind its behaviour.

- [Capabilities](capabilities.md) — what can be planned and what each view shows.
- [Scheduling and queuing](scheduling-and-queuing.md) — priority, capacity, queued work, and delivery dates.
- [Phase dependencies](phase-dependencies.md) — sequential gates, atomic start groups, branching, and SQL examples.
- [Decision log](decisions.md) — durable product decisions and their rationale.

The SQLite database holds plan intent. The scheduler calculates the timeline; it is not a manually edited Gantt chart.
