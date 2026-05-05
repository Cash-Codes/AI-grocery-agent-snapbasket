import { mkdirSync } from "node:fs";
import path from "node:path";

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import * as schema from "./schema";

const tursoUrl = process.env.TURSO_DATABASE_URL;
const localUrl = process.env.DATABASE_URL ?? path.resolve(process.cwd(), "data/snapbasket.db");
const isRemote = Boolean(tursoUrl);
const url = isRemote ? tursoUrl! : `file:${localUrl}`;
const authToken = isRemote ? process.env.TURSO_AUTH_TOKEN : undefined;
const migrationsFolder = path.resolve(process.cwd(), "drizzle");

if (!isRemote) {
  mkdirSync(path.dirname(localUrl), { recursive: true });
}

async function main() {
  const client = createClient({ url, ...(authToken ? { authToken } : {}) });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  console.log(`Migrations applied to ${url}`);
  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
