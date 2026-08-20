# Scheduling and queuing

## How a sprint is filled

For every engineer in every sprint, the scheduler:

1. Finds phases that are eligible to start or continue. A sequential phase waits until its predecessor is complete; a phase with a planned start waits until that sprint.
2. Calculates the person's available days from FTE, sprint working days, and time off.
3. Applies eligible assignments in project-priority order. A lower project priority number wins (priority `1` before `2`, then `3`).
4. Gives each assignment up to its requested fraction, stopping when the person's capacity or the phase's remaining effort is exhausted.
5. Carries undelivered effort into later sprints.

Within the same project priority, phases use their phase order as the tie-breaker. A completed short phase does not reserve the rest of a sprint: that remaining time may flow to the next eligible assignment.

## What “queued” means

A queued segment is visible in the Team view when a phase is eligible and requests time, but receives zero delivery days in that sprint. The striped segment preserves the requested allocation as a warning; it is not work being completed.

Queued work is retried in the next sprint. Its remaining effort is unchanged, so its calculated finish date moves later. If a later phase depends on it, that later phase moves later too. If the visible planning horizon ends first, the remaining work is shown as incomplete in that horizon.

For example, a person may have 120% requested work in a sprint. The planner can deliver at most 100% of their available capacity. Higher-priority work receives the capacity and the excess request is queued.

## Requested versus allocated

- **Requested** is the sum of eligible assignment fractions, limited only by the remaining work on each phase.
- **Allocated** is the work actually delivered after capacity and priority are applied.

The planner flags an overload when requested demand is more than 100% of available capacity. It does not schedule someone above their available capacity; instead, lower-precedence work waits.

## Example: ongoing relationship work

For two full-time people assigned at 20% each in ten-working-day sprints, the phase receives 4 combined person-days per unconstrained sprint. A 24-person-day phase therefore takes six such sprints—unless it is queued, either person has time off, or another constraint changes its available capacity.
