export type Selection =
  | { kind: "phase"; phaseId: string }
  | { kind: "idle"; engineerId: string; sprintId: string };
