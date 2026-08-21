# Scheduling and queuing

## How a sprint is filled

For every engineer in every sprint, the scheduler:

1. Finds phases that are eligible to start or continue. A phase waits for all finish-to-start predecessors and any planned start sprint. Every member of a start-together group must be able to receive work in the same sprint before the group begins.
2. Calculates the person's available days from FTE, sprint working days, and time off.
3. Applies eligible assignments in project-priority order. A lower project priority number wins (priority `1` before `2`, then `3`).
4. Gives each assignment up to its requested fraction, stopping when the person's capacity or the phase's remaining effort is exhausted.
5. Carries undelivered effort into later sprints.

Within the same project priority, phases use their display order as the tie-breaker. Display order does not create dependencies. A completed short phase does not reserve the rest of a sprint: that remaining time may flow to the next eligible assignment.

## Phase dependencies

Phase ordering is explicit in `phase_dependencies`:

- `finish_to_start` means the successor becomes eligible in the sprint after the predecessor finishes. A phase may have several predecessors and waits for all of them.
- `start_together` groups phases into one atomic start. All active members begin in the same sprint, but they can finish at different times.

Once a start-together group has begun, each phase follows its own effort and assignments. Later phases can depend on any individual member, so separate branches can continue as soon as their own predecessor finishes.

For example:

```text
Discovery finishes
        |
        +--> Build -----------------> Hypercare
        |      (starts together)
        +--> Data capability build -> Data follow-up
```

Moving Discovery moves both builds. A short Data capability build can finish and release its follow-up while Build is still running.

See [Phase dependencies](phase-dependencies.md) for the full model, database schema, branching rules, and editing examples.

## What “queued” means

A queued segment is visible in the Team view when a phase is eligible and requests time, but receives zero delivery days in that sprint. The striped segment preserves the requested allocation as a warning; it is not work being completed.

Queued work is retried in the next sprint. Its remaining effort is unchanged, so its calculated finish date moves later. If a later phase depends on it, that later phase moves later too. If the visible planning horizon ends first, the remaining work is shown as incomplete in that horizon.

For example, a person may have 120% requested work in a sprint. The planner can deliver at most 100% of their available capacity. Higher-priority work receives the capacity and the excess request is queued.

## Requested versus allocated

- **Requested** is the sum of eligible assignment fractions, limited only by the remaining work on each phase.
- **Allocated** is the work actually delivered after capacity and priority are applied.

The planner flags an overload when requested demand is more than 100% of available capacity. It does not schedule someone above their available capacity; instead, lower-precedence work waits.

## Model pauses as phases

When work needs a deliberate pause between two activities—such as discovery, review, approval, procurement, or a release window—model that pause as an explicit phase instead of relying only on a future start date for the next phase.

For example, a project can use this sequence:

```
Discovery → Solution → Approval → Build
```

- Add a `start_together` relationship between **Discovery** and **Solution** when they must begin in the same sprint. Leave them unrelated when either may start independently.
- Add **Approval** as a sequential phase, with its own effort, assignee, and planned start sprint. That makes the review period visible and gives it a real dependency.
- Add a `finish_to_start` dependency from **Approval** to **Build**. When discovery, solution, or approval runs late, Build naturally cascades later without needing manual date repairs.

An explicit pause phase also makes ownership and capacity visible: the person or group responsible for approval can be assigned directly, and simultaneous approvals will queue according to available capacity and project priority. Use a bare `start_sprint_id` only when there is no real intermediate activity or owner to model.

## Example: ongoing relationship work

For two full-time people assigned at 20% each in ten-working-day sprints, the phase receives 4 combined person-days per unconstrained sprint. A 24-person-day phase therefore takes six such sprints—unless it is queued, either person has time off, or another constraint changes its available capacity.
