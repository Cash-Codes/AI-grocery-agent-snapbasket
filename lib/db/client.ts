import "server-only";

import { mkdirSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import * as schema from "./schema";

const DEFAULT_DB_PATH = path.resolve(process.cwd(), "data/snapbasket.db");

let _sqlite: Database.Database | undefined;
let _db: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDb() {
  if (!_db) {
    const url = process.env.DATABASE_URL ?? DEFAULT_DB_PATH;
    mkdirSync(path.dirname(url), { recursive: true });
    _sqlite = new Database(url);
    _sqlite.pragma("journal_mode = WAL");
    _sqlite.pragma("foreign_keys = ON");
    _db = drizzle(_sqlite, { schema });
    // Apply migrations on first DB access. Idempotent because drizzle tracks
    // applied migrations in __drizzle_migrations. Required for Cloud Run's
    // ephemeral filesystem - every cold start gets a fresh SQLite file with
    // no schema, so the runtime needs to bootstrap it on demand.
    migrate(_db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
  }
  return _db;
}

export function closeDb() {
  _sqlite?.close();
  _sqlite = undefined;
  _db = undefined;
}
