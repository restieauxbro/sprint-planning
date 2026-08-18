import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { asc, eq, max } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import {
  assignments,
  engineers,
  phases,
  projects,
  sprints,
  timeOff,
  type Engineer,
  type Project,
  type ScheduleIntent,
} from "./schema";

const dbPath =
  process.env.PLANNER_DB ?? path.join(process.cwd(), "data", "planner.sqlite");

type SqliteHandle = Database.Database;

let client: SqliteHandle | null = null;

function openClient(): SqliteHandle {
  const db = new Database(dbPath, { fileMustExist: true });
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 2000");
  db.pragma("foreign_keys = ON");
  return db;
}

export function getDbPath() {
  return dbPath;
}

export function dbFileExists() {
  return fs.existsSync(/* turbopackIgnore: true */ dbPath);
}

export function reopenDb() {
  try {
    client?.close();
  } catch {
    // already closed
  }
  client = null;
}

function getClient(): SqliteHandle {
  if (!client) {
    client = openClient();
  }
  return client;
}

export function getDb() {
  return drizzle(getClient(), {
    schema: { engineers, sprints, projects, phases, assignments, timeOff },
  });
}

export type LoadIntentResult =
  | { ok: true; intent: ScheduleIntent }
  | { ok: false; error: "missing" | "stale" | "unknown"; message: string };

export function loadIntent(): LoadIntentResult {
  if (!dbFileExists()) {
    return {
      ok: false,
      error: "missing",
      message: `No database at ${dbPath}. Run npm run db:init.`,
    };
  }

  try {
    const db = getDb();
    const intent: ScheduleIntent = {
      engineers: db.select().from(engineers).orderBy(asc(engineers.sortOrder)).all(),
      sprints: db.select().from(sprints).orderBy(asc(sprints.startDate)).all(),
      projects: db.select().from(projects).orderBy(asc(projects.sortOrder)).all(),
      phases: db.select().from(phases).orderBy(asc(phases.sortOrder)).all(),
      assignments: db.select().from(assignments).all(),
      timeOff: db.select().from(timeOff).all(),
    };
    return { ok: true, intent };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    reopenDb();
    try {
      const db = getDb();
      const intent: ScheduleIntent = {
        engineers: db.select().from(engineers).orderBy(asc(engineers.sortOrder)).all(),
        sprints: db.select().from(sprints).orderBy(asc(sprints.startDate)).all(),
        projects: db.select().from(projects).orderBy(asc(projects.sortOrder)).all(),
        phases: db.select().from(phases).orderBy(asc(phases.sortOrder)).all(),
        assignments: db.select().from(assignments).all(),
        timeOff: db.select().from(timeOff).all(),
      };
      return { ok: true, intent };
    } catch (retryErr) {
      const retryMessage =
        retryErr instanceof Error ? retryErr.message : String(retryErr);
      const stale =
        /no such table|no such column/i.test(message) ||
        /no such table|no such column/i.test(retryMessage);
      return {
        ok: false,
        error: stale ? "stale" : "unknown",
        message: retryMessage,
      };
    }
  }
}

export type AddEngineerInput = {
  name: string;
  title: string;
  fte: number;
};

export type AddEngineerResult =
  | { ok: true; engineer: Engineer }
  | { ok: false; error: string };

function slugifyPersonId(name: string, taken: Set<string>) {
  const base =
    "eng_" +
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  const fallback = "eng_person";
  let id = base || fallback;
  let n = 2;
  while (taken.has(id)) {
    id = `${base || fallback}_${n}`;
    n += 1;
  }
  return id;
}

export function addEngineer(input: AddEngineerInput): AddEngineerResult {
  const name = input.name.trim();
  const title = input.title.trim();
  const fte = input.fte;
  if (!name) return { ok: false, error: "Name is required." };
  if (!title) return { ok: false, error: "Title is required." };
  if (!Number.isFinite(fte) || fte <= 0) return { ok: false, error: "FTE must be greater than 0." };

  if (!dbFileExists()) {
    return { ok: false, error: "Database missing. Run npm run db:init." };
  }

  try {
    const db = getDb();
    const existing = db.select().from(engineers).all();
    const id = slugifyPersonId(name, new Set(existing.map((row) => row.id)));
    const nextOrder = (db.select({ value: max(engineers.sortOrder) }).from(engineers).get()?.value ?? 0) + 1;
    db.insert(engineers)
      .values({ id, name, title, fte, sortOrder: nextOrder })
      .run();
    const engineer = db.select().from(engineers).where(eq(engineers.id, id)).get();
    if (!engineer) return { ok: false, error: "Could not read the new teammate back." };
    return { ok: true, engineer };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

export function renameEngineer(id: string, name: string): AddEngineerResult {
  const next = name.trim();
  if (!id) return { ok: false, error: "Missing teammate." };
  if (!next) return { ok: false, error: "Name is required." };

  if (!dbFileExists()) {
    return { ok: false, error: "Database missing. Run npm run db:init." };
  }

  try {
    const sqlite = getClient();
    const db = getDb();
    const existing = db.select().from(engineers).where(eq(engineers.id, id)).get();
    if (!existing) return { ok: false, error: "That teammate is not on the roster." };

    const taken = new Set(
      db
        .select()
        .from(engineers)
        .all()
        .map((row) => row.id)
        .filter((otherId) => otherId !== id),
    );
    const nextId = slugifyPersonId(next, taken);

    sqlite.transaction(() => {
      if (nextId === id) {
        db.update(engineers).set({ name: next }).where(eq(engineers.id, id)).run();
        return;
      }
      db.insert(engineers)
        .values({
          id: nextId,
          name: next,
          title: existing.title,
          fte: existing.fte,
          sortOrder: existing.sortOrder,
        })
        .run();
      db.update(assignments).set({ engineerId: nextId }).where(eq(assignments.engineerId, id)).run();
      db.update(timeOff).set({ engineerId: nextId }).where(eq(timeOff.engineerId, id)).run();
      db.delete(engineers).where(eq(engineers.id, id)).run();
    })();

    const engineer = db.select().from(engineers).where(eq(engineers.id, nextId)).get();
    if (!engineer) return { ok: false, error: "Could not read the teammate back." };
    return { ok: true, engineer };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

export type ProjectInput = {
  name: string;
  code: string;
  color: string;
  priority: number;
};

export type ProjectResult =
  | { ok: true; project: Project }
  | { ok: false; error: string };

function slugifyProjectId(name: string, taken: Set<string>) {
  const base =
    "proj_" +
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  const fallback = "proj_project";
  let id = base || fallback;
  let n = 2;
  while (taken.has(id)) {
    id = `${base || fallback}_${n}`;
    n += 1;
  }
  return id;
}

function validateProject(input: ProjectInput): { ok: true; value: ProjectInput } | { ok: false; error: string } {
  const name = input.name.trim();
  const code = input.code.trim();
  const color = input.color.trim();
  const priority = input.priority;
  if (!name) return { ok: false, error: "Project name is required." };
  if (!code) return { ok: false, error: "Project code is required." };
  if (!color) return { ok: false, error: "Project colour is required." };
  if (!Number.isInteger(priority) || priority < 1) {
    return { ok: false, error: "Priority must be a whole number of 1 or higher." };
  }
  return { ok: true, value: { name, code, color, priority } };
}

export function addProject(input: ProjectInput): ProjectResult {
  const validated = validateProject(input);
  if (!validated.ok) return validated;
  if (!dbFileExists()) return { ok: false, error: "Database missing. Run npm run db:init." };

  try {
    const db = getDb();
    const existing = db.select().from(projects).all();
    const id = slugifyProjectId(validated.value.name, new Set(existing.map((row) => row.id)));
    const sortOrder = (db.select({ value: max(projects.sortOrder) }).from(projects).get()?.value ?? 0) + 1;
    db.insert(projects).values({ id, ...validated.value, sortOrder }).run();
    const project = db.select().from(projects).where(eq(projects.id, id)).get();
    if (!project) return { ok: false, error: "Could not read the new project back." };
    return { ok: true, project };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function updateProject(id: string, input: ProjectInput): ProjectResult {
  const validated = validateProject(input);
  if (!validated.ok) return validated;
  if (!id) return { ok: false, error: "Missing project." };
  if (!dbFileExists()) return { ok: false, error: "Database missing. Run npm run db:init." };

  try {
    const db = getDb();
    const existing = db.select().from(projects).where(eq(projects.id, id)).get();
    if (!existing) return { ok: false, error: "That project no longer exists." };
    db.update(projects).set(validated.value).where(eq(projects.id, id)).run();
    const project = db.select().from(projects).where(eq(projects.id, id)).get();
    if (!project) return { ok: false, error: "Could not read the project back." };
    return { ok: true, project };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
