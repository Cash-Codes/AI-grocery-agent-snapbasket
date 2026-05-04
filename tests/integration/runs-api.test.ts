import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/db/schema";

// mock trigger.dev sdk before any module imports it.
vi.mock("@trigger.dev/sdk", () => ({
  tasks: {
    trigger: vi.fn().mockResolvedValue({ id: "fake_trigger_run_default" }),
  },
}));

let tempDir: string;
let dbPath: string;
let imagePath: string;
let sqlite: Database.Database;

beforeAll(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), "snapbasket-runs-"));
  dbPath = path.join(tempDir, "test.db");
  imagePath = path.join(tempDir, "test.png");

  sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });

  // Stub a tiny png on disk so the route can read its bytes.
  writeFileSync(imagePath, new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

  process.env.DATABASE_URL = dbPath;

  // Seed an image row pointing at the stub file.
  db.insert(schema.images)
    .values({
      id: "img_test_runs",
      sha256: "test_sha_runs",
      mime: "image/png",
      sizeBytes: 8,
      storagePath: imagePath,
    })
    .run();
});

afterAll(() => {
  sqlite.close();
  rmSync(tempDir, { recursive: true, force: true });
  delete process.env.DATABASE_URL;
});

describe("POST /api/runs", () => {
  it("creates a run row and calls tasks.trigger with the right payload", async () => {
    const { tasks } = await import("@trigger.dev/sdk");
    const { POST } = await import("@/app/api/runs/route");

    const triggerMock = tasks.trigger as ReturnType<typeof vi.fn>;
    triggerMock.mockClear();
    triggerMock.mockResolvedValue({ id: "fake_trigger_run_runs_test" });

    const req = new Request("http://localhost/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ imageId: "img_test_runs" }),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(201);

    const body = (await res.json()) as {
      runId: string;
      correlationId: string;
      triggerRunId: string;
    };
    expect(body.runId).toMatch(/^run_/);
    expect(body.correlationId).toMatch(/^corr_/);
    expect(body.triggerRunId).toBe("fake_trigger_run_runs_test");

    expect(triggerMock).toHaveBeenCalledTimes(1);
    const [taskId, payload] = triggerMock.mock.calls[0]!;
    expect(taskId).toBe("snapbasket.run");
    expect(payload).toMatchObject({
      runId: body.runId,
      correlationId: body.correlationId,
      imageId: "img_test_runs",
      sha256: "test_sha_runs",
      mime: "image/png",
    });
    expect(payload.imageBytes).toBeInstanceOf(Uint8Array);

    // verify the run row got triggerRunId persisted.
    const { getDb } = await import("@/lib/db/client");
    const { eq } = await import("drizzle-orm");
    const db = getDb();
    const runRow = db.select().from(schema.runs).where(eq(schema.runs.id, body.runId)).all()[0];
    expect(runRow?.triggerRunId).toBe("fake_trigger_run_runs_test");
  });

  it("returns 404 when imageId is unknown", async () => {
    const { POST } = await import("@/app/api/runs/route");
    const req = new Request("http://localhost/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ imageId: "img_does_not_exist" }),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(404);
  });

  it("returns 400 on invalid body", async () => {
    const { POST } = await import("@/app/api/runs/route");
    const req = new Request("http://localhost/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wrongField: "x" }),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });
});
