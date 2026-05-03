import "server-only";

import path from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema";

const DEFAULT_DB_PATH = path.resolve(process.cwd(), "data/snapbasket.db");

let _sqlite: Database.Database | undefined;
let _db: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDb() {
  if (!_db) {
    const url = process.env.DATABASE_URL ?? DEFAULT_DB_PATH;
    _sqlite = new Database(url);
    _sqlite.pragma("journal_mode = WAL");
    _sqlite.pragma("foreign_keys = ON");
    _db = drizzle(_sqlite, { schema });
  }
  return _db;
}

export function closeDb() {
  _sqlite?.close();
  _sqlite = undefined;
  _db = undefined;
}
