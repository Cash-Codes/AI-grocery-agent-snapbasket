import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/db/schema";

// mock tasks.trigger before any module imports it.
vi.mock("@trigger.dev/sdk", () => ({
  tasks: {
    trigger: vi.fn().mockResolvedValue({ id: "fake_trigger_run_demo_default" }),
  },
}));

let tempDir: string;
let dbPath: string;
let sqlite: Database.Database;

beforeAll(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), "snapbasket-demo-"));
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

describe("POST /api/runs/demo", () => {
  it("first call: ingests bundled image, creates run, calls tasks.trigger, persists triggerRunId", async () => {
    const { tasks } = await import("@trigger.dev/sdk");
    const { POST } = await import("@/app/api/runs/demo/route");

    const triggerMock = tasks.trigger as ReturnType<typeof vi.fn>;
    triggerMock.mockClear();
    triggerMock.mockResolvedValue({ id: "fake_trigger_run_demo_1" });

    const res = await POST();
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      runId: string;
      correlationId: string;
      triggerRunId: string;
      imageId: string;
      isDuplicate: boolean;
    };
    expect(body.runId).toMatch(/^run_/);
    expect(body.correlationId).toMatch(/^corr_/);
    expect(body.triggerRunId).toBe("fake_trigger_run_demo_1");
    expect(body.imageId).toMatch(/^img_/);
    expect(body.isDuplicate).toBe(false);

    // tasks.trigger called once with the right task id + payload shape.
    expect(triggerMock).toHaveBeenCalledTimes(1);
    const [taskId, payload] = triggerMock.mock.calls[0]!;
    expect(taskId).toBe("snapbasket.run");
    expect(payload).toMatchObject({
      runId: body.runId,
      correlationId: body.correlationId,
      imageId: body.imageId,
      mime: "image/png",
    });
    expect(payload.sha256).toMatch(/^[a-f0-9]+$/);
    expect(payload.imageBytes).toBeInstanceOf(Uint8Array);

    // run row persisted with triggerRunId.
    const { getDb } = await import("@/lib/db/client");
    const { eq } = await import("drizzle-orm");
    const db = getDb();
    const runRow = db.select().from(schema.runs).where(eq(schema.runs.id, body.runId)).all()[0];
    expect(runRow?.triggerRunId).toBe("fake_trigger_run_demo_1");
    expect(runRow?.imageId).toBe(body.imageId);
  });

  it("second call: deduplicates the bundled image (sha256 match), still creates a new run", async () => {
    const { tasks } = await import("@trigger.dev/sdk");
    const { POST } = await import("@/app/api/runs/demo/route");

    const triggerMock = tasks.trigger as ReturnType<typeof vi.fn>;
    triggerMock.mockClear();
    triggerMock.mockResolvedValue({ id: "fake_trigger_run_demo_2" });

    const res = await POST();
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      runId: string;
      triggerRunId: string;
      imageId: string;
      isDuplicate: boolean;
    };
    // dedup signal flips on the second call (same bundled image)
    expect(body.isDuplicate).toBe(true);
    expect(body.triggerRunId).toBe("fake_trigger_run_demo_2");

    // a fresh run is still created - different runId from the first call,
    // but the imageId resolves to the same row (dedup hit).
    expect(triggerMock).toHaveBeenCalledTimes(1);
  });
});
