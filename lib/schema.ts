import { integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const engineers = sqliteTable("engineers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  title: text("title").notNull().default("Engineer"),
  fte: real("fte").notNull().default(1),
  tags: text("tags").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const sprints = sqliteTable("sprints", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  workingDays: real("working_days").notNull().default(10),
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  color: text("color").notNull().default("teal"),
  priority: integer("priority").notNull().default(1),
  tags: text("tags").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const phases = sqliteTable("phases", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  kind: text("kind"),
  sortOrder: integer("sort_order").notNull().default(0),
  effortDays: real("effort_days").notNull(),
  startSprintId: text("start_sprint_id").references(() => sprints.id),
});

export const phaseDependencies = sqliteTable(
  "phase_dependencies",
  {
    predecessorPhaseId: text("predecessor_phase_id")
      .notNull()
      .references(() => phases.id, { onDelete: "cascade" }),
    successorPhaseId: text("successor_phase_id")
      .notNull()
      .references(() => phases.id, { onDelete: "cascade" }),
    dependencyType: text("dependency_type", {
      enum: ["finish_to_start", "start_together"],
    }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.predecessorPhaseId, table.successorPhaseId, table.dependencyType],
    }),
  ],
);

export const assignments = sqliteTable(
  "assignments",
  {
    phaseId: text("phase_id")
      .notNull()
      .references(() => phases.id, { onDelete: "cascade" }),
    engineerId: text("engineer_id")
      .notNull()
      .references(() => engineers.id, { onDelete: "cascade" }),
    fraction: real("fraction").notNull(),
  },
  (table) => [primaryKey({ columns: [table.phaseId, table.engineerId] })],
);

export const timeOff = sqliteTable(
  "time_off",
  {
    engineerId: text("engineer_id")
      .notNull()
      .references(() => engineers.id, { onDelete: "cascade" }),
    sprintId: text("sprint_id")
      .notNull()
      .references(() => sprints.id, { onDelete: "cascade" }),
    daysOff: real("days_off").notNull(),
    placement: text("placement").notNull().default("start"),
  },
  (table) => [primaryKey({ columns: [table.engineerId, table.sprintId] })],
);

export const savedViews = sqliteTable("saved_views", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  config: text("config").notNull(),
  isDefault: integer("is_default").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type Engineer = Omit<typeof engineers.$inferSelect, "tags"> & { tags?: string | null };
export type Sprint = typeof sprints.$inferSelect;
export type Project = Omit<typeof projects.$inferSelect, "color" | "tags"> & {
  color?: string | null;
  tags?: string | null;
};
export type Phase = Omit<typeof phases.$inferSelect, "startSprintId"> & {
  startSprintId?: string | null;
};
export type PhaseDependency = typeof phaseDependencies.$inferSelect;
export type Assignment = typeof assignments.$inferSelect;
export type TimeOff = typeof timeOff.$inferSelect;

export type ScheduleIntent = {
  engineers: Engineer[];
  sprints: Sprint[];
  projects: Project[];
  phases: Phase[];
  phaseDependencies: PhaseDependency[];
  assignments: Assignment[];
  timeOff: TimeOff[];
};
