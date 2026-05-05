import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "@/lib/db/schema";

let tempDir: string;
let dbPath: string;
let client: Client;

beforeAll(async () => {
  tempDir = mkdtempSync(path.join(tmpdir(), "snapbasket-upload-"));
  dbPath = path.join(tempDir, "test.db");
  client = createClient({ url: `file:${dbPath}` });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
  process.env.DATABASE_URL = dbPath;
});

afterAll(() => {
  client.close();
  rmSync(tempDir, { recursive: true, force: true });
  delete process.env.DATABASE_URL;
});

describe("ingestImage helper", () => {
  it("rejects empty bytes", async () => {
    const { ingestImage, UploadError } = await import("@/lib/server/upload");
    await expect(ingestImage({ bytes: new Uint8Array(0), mime: "image/png" })).rejects.toThrowError(
      UploadError,
    );
  });

  it("rejects unsupported MIME", async () => {
    const { ingestImage, UploadError } = await import("@/lib/server/upload");
    await expect(
      ingestImage({ bytes: new Uint8Array([1, 2, 3]), mime: "application/pdf" }),
    ).rejects.toThrowError(UploadError);
  });

  it("creates a new image record on first upload", async () => {
    const { ingestImage } = await import("@/lib/server/upload");
    const result = await ingestImage({
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
    const first = await ingestImage({ bytes, mime: "image/png" });
    const second = await ingestImage({ bytes, mime: "image/png" });
    expect(second.imageId).toBe(first.imageId);
    expect(second.isDuplicate).toBe(true);
  });

  it("rejects files larger than 8 MB", async () => {
    const { ingestImage, UploadError } = await import("@/lib/server/upload");
    const oversize = new Uint8Array(8 * 1024 * 1024 + 1); // 8MB + 1 byte
    await expect(ingestImage({ bytes: oversize, mime: "image/png" })).rejects.toThrowError(
      UploadError,
    );
  });

  it("accepts image/jpeg as a valid MIME type", async () => {
    const { ingestImage } = await import("@/lib/server/upload");
    const result = await ingestImage({
      bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), // JPEG magic
      mime: "image/jpeg",
    });
    expect(result.imageId).toMatch(/^img_/);
  });

  it("accepts image/webp as a valid MIME type", async () => {
    const { ingestImage } = await import("@/lib/server/upload");
    const result = await ingestImage({
      bytes: new Uint8Array([0x52, 0x49, 0x46, 0x46]), // RIFF header
      mime: "image/webp",
    });
    expect(result.imageId).toMatch(/^img_/);
  });
});
