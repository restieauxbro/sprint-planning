# Phase dependencies

Phase scheduling is controlled by explicit relationships in `phase_dependencies`. A phase's `sort_order` only controls where it appears in the interface; moving a row does not change the schedule.

## Relationship types

### Finish to start

`finish_to_start` makes a successor wait until its predecessor has finished. The successor becomes eligible in the following sprint.

A phase can have multiple finish-to-start predecessors. It waits until all of them are complete.

```text
Discovery ──finishes──> Approval ──finishes──> Build
```

### Start together

`start_together` puts phases into an atomic start group. Every active member must be able to receive work in the same sprint before any member begins.

After the first sprint, the phases are independent:

- each phase consumes its own effort;
- each phase uses its own assignments and allocation fractions;
- phases can finish in different sprints;
- downstream work can depend on an individual group member.

Start-together relationships are symmetric and transitive. If A starts with B and B starts with C, all three form one start group. The predecessor and successor column names do not imply direction for this relationship type.

## Branching example

```text
Discovery finishes
        |
        v
  +-------------------------------+
  | Atomic start group            |
  |                               |
  | Build                         |──finishes──> Hypercare
  | Data capability build         |──finishes──> Data follow-up
  +-------------------------------+
```

If Discovery moves, both builds move. If Data capability build finishes first, Data follow-up can start while Build continues. Hypercare still waits specifically for Build.

This is represented by four records:

```sql
INSERT INTO phase_dependencies (
  predecessor_phase_id,
  successor_phase_id,
  dependency_type
) VALUES
  ('phase_discovery', 'phase_build', 'finish_to_start'),
  ('phase_build', 'phase_data_build', 'start_together'),
  ('phase_build', 'phase_hypercare', 'finish_to_start'),
  ('phase_data_build', 'phase_data_followup', 'finish_to_start');
```

The finish-to-start dependency on Build releases the whole start group because Build and Data capability build must begin together.

## Planned starts and capacity

`phases.start_sprint_id` remains a lower bound, not a fixed timeline position.

For a start-together group:

1. every finish-to-start predecessor for every group member must be complete;
2. every member's planned start must have been reached;
3. every active member must be able to receive a positive amount of work in that sprint.

The latest constraint controls the group's first sprint. Time off, higher-priority work, missing assignments, or insufficient shared capacity can therefore hold the whole group. Once the group starts, later capacity changes affect each member separately.

The inspector explains the calculated start and lists the other phases in the start group. It also shows every phase with a direct finish-to-start dependency on the selected phase, including assignments and allocation percentages.

## Database schema

```sql
CREATE TABLE phase_dependencies (
  predecessor_phase_id TEXT NOT NULL REFERENCES phases(id) ON DELETE CASCADE,
  successor_phase_id TEXT NOT NULL REFERENCES phases(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL
    CHECK (dependency_type IN ('finish_to_start', 'start_together')),
  CHECK (predecessor_phase_id <> successor_phase_id),
  PRIMARY KEY (
    predecessor_phase_id,
    successor_phase_id,
    dependency_type
  )
);
```

Deleting a phase automatically deletes its dependency records. Deleting a relationship does not delete either phase.

## Editing dependencies

Look up the current graph:

```sql
SELECT
  predecessor_phase_id,
  successor_phase_id,
  dependency_type
FROM phase_dependencies
ORDER BY predecessor_phase_id, successor_phase_id;
```

Add a sequential dependency:

```sql
INSERT INTO phase_dependencies VALUES (
  'phase_discovery',
  'phase_build',
  'finish_to_start'
);
```

Make two phases start together:

```sql
INSERT INTO phase_dependencies VALUES (
  'phase_build',
  'phase_data_build',
  'start_together'
);
```

Change a relationship by deleting the old record and inserting the new one in a transaction:

```sql
BEGIN;

DELETE FROM phase_dependencies
WHERE predecessor_phase_id = 'phase_discovery'
  AND successor_phase_id = 'phase_build'
  AND dependency_type = 'finish_to_start';

INSERT INTO phase_dependencies VALUES (
  'phase_discovery',
  'phase_build',
  'start_together'
);

COMMIT;
```

## Modelling rules

- Use `finish_to_start` for genuine completion gates.
- Use `start_together` only when beginning in different sprints would make the plan invalid.
- Leave phases unrelated when they may overlap or start independently.
- Use explicit dependencies for every branch; do not rely on display order.
- Avoid circular finish-to-start paths and finish dependencies within one start group.
- Keep dependencies within a project unless there is a deliberate cross-project delivery gate.
- Model approvals, reviews, and release gates as phases when they consume time or have an owner.

The previous `parallel_ok` phase flag has been removed. There is no implicit dependency on the preceding display row and no backwards-compatibility behaviour.
