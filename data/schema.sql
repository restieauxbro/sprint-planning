-- Sprint planner source of truth.
-- Agents write INTENT here (who, what, how big, what fraction).
-- The app COMPUTES the timeline; do not insert Gantt bars.
--
-- Units: effort_days is person-days. 1 person-week = 5 days.
-- A default sprint is 10 working days. FTE 1.0 = 10 person-days / sprint.
-- fraction is 0–1 share of that engineer's capacity while the phase is eligible.
-- priority: 1 = first claim on contended capacity.

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 2000;

CREATE TABLE IF NOT EXISTS engineers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Engineer', -- Engineer, BA, …
  fte REAL NOT NULL DEFAULT 1.0 CHECK (fte > 0),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sprints (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL, -- YYYY-MM-DD
  end_date TEXT NOT NULL,
  working_days REAL NOT NULL DEFAULT 10 CHECK (working_days > 0)
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL, -- short label on bars: letters, emoji, whatever (Chk, 🧠)
  color TEXT NOT NULL DEFAULT 'teal', -- palette id used on planner cards
  priority INTEGER NOT NULL DEFAULT 1 CHECK (priority >= 1),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS phases (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT, -- discovery | solution | backend | frontend | other
  sort_order INTEGER NOT NULL DEFAULT 0,
  effort_days REAL NOT NULL CHECK (effort_days >= 0),
  parallel_ok INTEGER NOT NULL DEFAULT 0 CHECK (parallel_ok IN (0, 1))
);

CREATE TABLE IF NOT EXISTS assignments (
  phase_id TEXT NOT NULL REFERENCES phases(id) ON DELETE CASCADE,
  engineer_id TEXT NOT NULL REFERENCES engineers(id) ON DELETE CASCADE,
  fraction REAL NOT NULL CHECK (fraction > 0 AND fraction <= 1),
  PRIMARY KEY (phase_id, engineer_id)
);

CREATE TABLE IF NOT EXISTS time_off (
  engineer_id TEXT NOT NULL REFERENCES engineers(id) ON DELETE CASCADE,
  sprint_id TEXT NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
  days_off REAL NOT NULL CHECK (days_off >= 0),
  PRIMARY KEY (engineer_id, sprint_id)
);
