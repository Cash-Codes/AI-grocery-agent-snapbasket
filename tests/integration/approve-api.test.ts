import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/db/schema";

// mock wait.completeToken before any module imports it.
const mockCompleteToken = vi.hoisted(() => vi.fn());

vi.mock("@trigger.dev/sdk", () => ({
  wait: { completeToken: mockCompleteToken },
}));

let tempDir: string;
let dbPath: string;
let sqlite: Database.Database;

beforeAll(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), "snapbasket-approve-"));
  dbPath = path.join(tempDir, "test.db");
  sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
  process.env.DATABASE_URL = dbPath;

  // seed - one image, one run AWAITING_APPROVAL, one run already COMPLETED.
  db.insert(schema.images)
    .values({
      id: "img_approve",
      sha256: "approve_sha",
      mime: "image/png",
      sizeBytes: 1,
      storagePath: "/tmp/approve.png",
    })
    .run();

  db.insert(schema.runs)
    .values({
      id: "run_awaiting",
      imageId: "img_approve",
      userId: "user_default",
      correlationId: "corr_approve",
      status: "AWAITING_APPROVAL",
      approvalTokenId: "tok_pending_123",
    })
    .run();

  db.insert(schema.runs)
    .values({
      id: "run_completed",
      imageId: "img_approve",
      userId: "user_default",
      correlationId: "corr_completed",
      status: "COMPLETED",
      approvalTokenId: "tok_done_456",
    })
    .run();
});

afterAll(() => {
  sqlite.close();
  rmSync(tempDir, { recursive: true, force: true });
  delete process.env.DATABASE_URL;
});

describe("POST /api/runs/[runId]/approve", () => {
  it("happy path: persists userConsents BEFORE calling wait.completeToken", async () => {
    mockCompleteToken.mockClear();
    mockCompleteToken.mockResolvedValue(undefined);

    const { POST } = await import("@/app/api/runs/[runId]/approve/route");

    const req = new Request("http://localhost/api/runs/run_awaiting/approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        approved: true,
        decidedBy: "user_default",
        reason: "looks fine",
      }),
    });

    const res = await POST(req as never, {
      params: Promise.resolve({ runId: "run_awaiting" }),
    });
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      ok: boolean;
      decision: { approved: boolean; decidedAt: string };
    };
    expect(body.ok).toBe(true);
    expect(body.decision.approved).toBe(true);
    expect(typeof body.decision.decidedAt).toBe("string");

    // Verify wait.completeToken was called with the right args.
    expect(mockCompleteToken).toHaveBeenCalledTimes(1);
    const call = mockCompleteToken.mock.calls[0];
    expect(call?.[0]).toBe("tok_pending_123");
    expect(call?.[1]).toMatchObject({
      approved: true,
      decidedBy: "user_default",
      reason: "looks fine",
    });

    // verify userConsents was persisted (the audit-before-completion guarantee)
    const { getDb } = await import("@/lib/db/client");
    const { eq } = await import("drizzle-orm");
    const db = getDb();
    const consents = db
      .select()
      .from(schema.userConsents)
      .where(eq(schema.userConsents.runId, "run_awaiting"))
      .all();
    expect(consents).toHaveLength(1);
    expect(consents[0]?.approved).toBe(true);
    expect(consents[0]?.decidedBy).toBe("user_default");
    expect(consents[0]?.reason).toBe("looks fine");
  });

  it("returns 404 when run is unknown", async () => {
    mockCompleteToken.mockClear();
    const { POST } = await import("@/app/api/runs/[runId]/approve/route");

    const req = new Request("http://localhost/api/runs/run_does_not_exist/approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ approved: true, decidedBy: "u", reason: null }),
    });

    const res = await POST(req as never, {
      params: Promise.resolve({ runId: "run_does_not_exist" }),
    });
    expect(res.status).toBe(404);
    expect(mockCompleteToken).not.toHaveBeenCalled();
  });

  it("returns 409 when run is not in AWAITING_APPROVAL state", async () => {
    mockCompleteToken.mockClear();
    const { POST } = await import("@/app/api/runs/[runId]/approve/route");

    const req = new Request("http://localhost/api/runs/run_completed/approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ approved: true, decidedBy: "u", reason: null }),
    });

    const res = await POST(req as never, {
      params: Promise.resolve({ runId: "run_completed" }),
    });
    expect(res.status).toBe(409);
    expect(mockCompleteToken).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid body", async () => {
    mockCompleteToken.mockClear();
    const { POST } = await import("@/app/api/runs/[runId]/approve/route");

    const req = new Request("http://localhost/api/runs/run_awaiting/approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wrongField: "garbage" }),
    });

    const res = await POST(req as never, {
      params: Promise.resolve({ runId: "run_awaiting" }),
    });
    expect(res.status).toBe(400);
    expect(mockCompleteToken).not.toHaveBeenCalled();
  });
});
