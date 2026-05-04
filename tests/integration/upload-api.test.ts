import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "@/lib/db/schema";

let tempDir: string;
let dbPath: string;
let sqlite: Database.Database;

beforeAll(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), "snapbasket-upload-"));
  dbPath = path.join(tempDir, "test.db");
  sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
  process.env.DATABASE_URL = dbPath;
});

afterAll(() => {
  sqlite.close();
  rmSync(tempDir, { recursive: true, force: true });
  delete process.env.DATABASE_URL;
});

describe("ingestImage helper", () => {
  it("rejects empty bytes", async () => {
    const { ingestImage, UploadError } = await import("@/lib/server/upload");
    expect(() => ingestImage({ bytes: new Uint8Array(0), mime: "image/png" })).toThrowError(
      UploadError,
    );
  });

  it("rejects unsupported MIME", async () => {
    const { ingestImage, UploadError } = await import("@/lib/server/upload");
    expect(() =>
      ingestImage({ bytes: new Uint8Array([1, 2, 3]), mime: "application/pdf" }),
    ).toThrowError(UploadError);
  });

  it("creates a new image record on first upload", async () => {
    const { ingestImage } = await import("@/lib/server/upload");
    const result = ingestImage({
      bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
      mime: "image/png",
    });
    expect(result.imageId).toMatch(/^img_/);
    expect(result.isDuplicate).toBe(false);
    expect(result.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns the existing record on duplicate sha256", async () => {
    const { ingestImage } = await import("@/lib/server/upload");
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    const first = ingestImage({ bytes, mime: "image/png" });
    const second = ingestImage({ bytes, mime: "image/png" });
    expect(second.imageId).toBe(first.imageId);
    expect(second.isDuplicate).toBe(true);
  });
});
