import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "@/lib/db/schema";

let tempDir: string;
let sqlite: Database.Database;
let db: ReturnType<typeof drizzle<typeof schema>>;

beforeAll(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), "snapbasket-test-"));
  const dbPath = path.join(tempDir, "test.db");
  sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
});

afterAll(() => {
  sqlite.close();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("db schema smoke", () => {
  it("round-trips through every table category", () => {
    const imageId = "img_smoke";
    db.insert(schema.images)
      .values({
        id: imageId,
        sha256: "abc123",
        mime: "image/png",
        sizeBytes: 1024,
        storagePath: "/tmp/sample.png",
      })
      .run();

    const runId = "run_smoke";
    db.insert(schema.runs)
      .values({
        id: runId,
        imageId,
        userId: "user_smoke",
        correlationId: "corr_smoke",
      })
      .run();

    const intentId = "intent_smoke";
    db.insert(schema.productIntents)
      .values({
        id: intentId,
        runId,
        originalText: "milk x2",
        canonicalName: "whole milk",
        quantity: 2,
        unit: "litre",
        category: "dairy",
        confidence: 0.95,
        needsClarification: false,
        clarificationReason: null,
      })
      .run();

    const candidateId = "cand_smoke";
    db.insert(schema.productCandidates)
      .values({
        id: candidateId,
        intentId,
        providerProductId: "prov_milk_001",
        name: "Sainsbury's British Whole Milk 2L",
        pricePence: 250,
        unit: "litre",
        thumbnailUrl: null,
        score: 0.92,
        isSelected: true,
      })
      .run();

    const basketId = "basket_smoke";
    db.insert(schema.baskets)
      .values({
        id: basketId,
        runId,
        providerBasketId: "prov_basket_001",
        totalPence: 500,
        itemCount: 1,
        idempotencyKey: "idem_basket_smoke",
      })
      .run();

    db.insert(schema.basketItems)
      .values({
        id: "bi_smoke",
        basketId,
        candidateId,
        quantity: 2,
        linePricePence: 500,
      })
      .run();

    db.insert(schema.policyResults)
      .values({
        id: "pol_smoke",
        basketId,
        ok: true,
        requiresExplicitApproval: false,
        totalCostPence: 500,
        flagsJson: "[]",
      })
      .run();

    db.insert(schema.workflowEvents)
      .values({
        id: "evt_smoke",
        runId,
        step: "buildBasket",
        status: "succeeded",
        attempt: 1,
        correlationId: "corr_smoke",
      })
      .run();

    db.insert(schema.userConsents)
      .values({
        id: "con_smoke",
        runId,
        decidedBy: "user_smoke",
        approved: true,
        reason: null,
      })
      .run();

    // Read each row back to confirm round-trip.
    const [image] = db.select().from(schema.images).where(eq(schema.images.id, imageId)).all();
    expect(image?.sha256).toBe("abc123");

    const [run] = db.select().from(schema.runs).where(eq(schema.runs.id, runId)).all();
    expect(run?.status).toBe("PENDING");

    const [basket] = db.select().from(schema.baskets).where(eq(schema.baskets.id, basketId)).all();
    expect(basket?.itemCount).toBe(1);

    const [policy] = db
      .select()
      .from(schema.policyResults)
      .where(eq(schema.policyResults.basketId, basketId))
      .all();
    expect(policy?.ok).toBe(true);

    const events = db
      .select()
      .from(schema.workflowEvents)
      .where(eq(schema.workflowEvents.runId, runId))
      .all();
    expect(events).toHaveLength(1);
    expect(events[0]?.status).toBe("succeeded");
  });

  it("enforces idempotency unique on baskets", () => {
    const runId = "run_idem";
    db.insert(schema.images)
      .values({
        id: "img_idem",
        sha256: "idem-sha",
        mime: "image/png",
        sizeBytes: 1,
        storagePath: "/tmp/idem.png",
      })
      .run();
    db.insert(schema.runs)
      .values({ id: runId, imageId: "img_idem", userId: "u", correlationId: "c" })
      .run();
    db.insert(schema.baskets)
      .values({
        id: "b1",
        runId,
        providerBasketId: "p1",
        totalPence: 0,
        itemCount: 0,
        idempotencyKey: "shared-key",
      })
      .run();

    expect(() =>
      db
        .insert(schema.baskets)
        .values({
          id: "b2",
          runId,
          providerBasketId: "p2",
          totalPence: 0,
          itemCount: 0,
          idempotencyKey: "shared-key",
        })
        .run(),
    ).toThrowError(/UNIQUE/i);
  });
});
