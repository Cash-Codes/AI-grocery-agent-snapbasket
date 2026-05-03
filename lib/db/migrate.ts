import { mkdirSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? path.resolve(process.cwd(), "data/snapbasket.db");
const migrationsFolder = path.resolve(process.cwd(), "drizzle");

mkdirSync(path.dirname(url), { recursive: true });

const sqlite = new Database(url);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

const db = drizzle(sqlite, { schema });
migrate(db, { migrationsFolder });

console.log(`Migrations applied to ${url}`);
sqlite.close();
