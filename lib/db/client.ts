import "server-only";

import { mkdirSync } from "node:fs";
import path from "node:path";

import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import * as schema from "./schema";

const DEFAULT_DB_PATH = path.resolve(process.cwd(), "data/snapbasket.db");

let _client: Client | undefined;
let _db: ReturnType<typeof drizzle<typeof schema>> | undefined;
let _migrated = false;

export function getDb() {
  if (!_db) {
    // Connection target precedence: TURSO_DATABASE_URL > DATABASE_URL > local file.
    // - TURSO_DATABASE_URL: remote Turso (libsql://...) for production deploys where
    //   web tier and trigger.dev workers need shared state.
    // - DATABASE_URL: file path (legacy, also used by tests).
    // - Default: local data/snapbasket.db.
    const tursoUrl = process.env.TURSO_DATABASE_URL;
    const localUrl = process.env.DATABASE_URL ?? DEFAULT_DB_PATH;
    const isRemote = Boolean(tursoUrl);
    const url = isRemote ? tursoUrl! : `file:${localUrl}`;
    const authToken = isRemote ? process.env.TURSO_AUTH_TOKEN : undefined;

    if (!isRemote) {
      mkdirSync(path.dirname(localUrl), { recursive: true });
    }

    _client = createClient({ url, ...(authToken ? { authToken } : {}) });
    _db = drizzle(_client, { schema });
  }
  return _db;
}

// Apply migrations on first DB access. Idempotent because drizzle tracks
// applied migrations in __drizzle_migrations. Required for Cloud Run's
// ephemeral filesystem and for fresh Turso databases - the runtime needs
// to bootstrap schema on demand.
//
// Why a separate function from getDb(): migrations are async, but most callers
// expect getDb() to be sync (they synchronously chain query builder calls
// before the terminal await). Callers that need to ensure schema exists
// before any query should `await ensureMigrated()` once on startup or before
// the first DB call.
export async function ensureMigrated() {
  if (_migrated) return;
  const db = getDb();
  await migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
  _migrated = true;
}

export function closeDb() {
  _client?.close();
  _client = undefined;
  _db = undefined;
  _migrated = false;
}
