import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const root = path.join(import.meta.dirname, "..");
const dbPath = path.join(root, "data", "planner.sqlite");
const schema = fs.readFileSync(path.join(root, "data", "schema.sql"), "utf8");
const seed = fs.readFileSync(path.join(root, "data", "seed.sql"), "utf8");

for (const extra of ["", "-wal", "-shm"]) {
  try {
    fs.unlinkSync(dbPath + extra);
  } catch {
    // ignore missing
  }
}

const db = new Database(dbPath);
db.exec(schema);
db.exec(seed);
db.close();
console.log("initialized", dbPath);
