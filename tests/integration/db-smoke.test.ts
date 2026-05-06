import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createClient, type Client } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "@/lib/db/schema";

let tempDir: string;
let client: Client;
let db: ReturnType<typeof drizzle<typeof schema>>;

beforeAll(async () => {
  tempDir = mkdtempSync(path.join(tmpdir(), "snapbasket-test-"));
  const dbPath = path.join(tempDir, "test.db");
  client = createClient({ url: `file:${dbPath}` });
  db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
});

afterAll(() => {
  client.close();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("db schema smoke", () => {
  it("round-trips through every table category", async () => {
    const imageId = "img_smoke";
    await db
      .insert(schema.images)
      .values({
        id: imageId,
        sha256: "abc123",
        mime: "image/png",
        sizeBytes: 1024,
        storagePath: "/tmp/sample.png",
      })
      .run();

    const runId = "run_smoke";
    await db
      .insert(schema.runs)
      .values({
        id: runId,
        imageId,
        userId: "user_smoke",
        correlationId: "corr_smoke",
      })
      .run();

    const intentId = "intent_smoke";
    await db
      .insert(schema.productIntents)
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
    await db
      .insert(schema.productCandidates)
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
    await db
      .insert(schema.baskets)
      .values({
        id: basketId,
        runId,
        providerBasketId: "prov_basket_001",
        totalPence: 500,
        itemCount: 1,
        idempotencyKey: "idem_basket_smoke",
      })
      .run();

    await db
      .insert(schema.basketItems)
      .values({
        id: "bi_smoke",
        basketId,
        candidateId,
        quantity: 2,
        linePricePence: 500,
      })
      .run();

    await db
      .insert(schema.policyResults)
      .values({
        id: "pol_smoke",
        basketId,
        ok: true,
        requiresExplicitApproval: false,
        totalCostPence: 500,
        flagsJson: "[]",
      })
      .run();

    await db
      .insert(schema.workflowEvents)
      .values({
        id: "evt_smoke",
        runId,
        step: "buildBasket",
        status: "succeeded",
        attempt: 1,
        correlationId: "corr_smoke",
      })
      .run();

    await db
      .insert(schema.userConsents)
      .values({
        id: "con_smoke",
        runId,
        decidedBy: "user_smoke",
        approved: true,
        reason: null,
      })
      .run();

    // Read each row back to confirm round-trip.
    const [image] = await db
      .select()
      .from(schema.images)
      .where(eq(schema.images.id, imageId))
      .all();
    expect(image?.sha256).toBe("abc123");

    const [run] = await db.select().from(schema.runs).where(eq(schema.runs.id, runId)).all();
    expect(run?.status).toBe("PENDING");

    const [basket] = await db
      .select()
      .from(schema.baskets)
      .where(eq(schema.baskets.id, basketId))
      .all();
    expect(basket?.itemCount).toBe(1);

    const [policy] = await db
      .select()
      .from(schema.policyResults)
      .where(eq(schema.policyResults.basketId, basketId))
      .all();
    expect(policy?.ok).toBe(true);

    const events = await db
      .select()
      .from(schema.workflowEvents)
      .where(eq(schema.workflowEvents.runId, runId))
      .all();
    expect(events).toHaveLength(1);
    expect(events[0]?.status).toBe("succeeded");
  });

  it("enforces idempotency unique on baskets", async () => {
    const runId = "run_idem";
    await db
      .insert(schema.images)
      .values({
        id: "img_idem",
        sha256: "idem-sha",
        mime: "image/png",
        sizeBytes: 1,
        storagePath: "/tmp/idem.png",
      })
      .run();
    await db
      .insert(schema.runs)
      .values({ id: runId, imageId: "img_idem", userId: "u", correlationId: "c" })
      .run();
    await db
      .insert(schema.baskets)
      .values({
        id: "b1",
        runId,
        providerBasketId: "p1",
        totalPence: 0,
        itemCount: 0,
        idempotencyKey: "shared-key",
      })
      .run();

    // libsql wraps the underlying SQLITE_CONSTRAINT error in a generic "Failed query" message;
    // the original UNIQUE violation surfaces on `.cause.message`.
    let captured: unknown;
    try {
      await db
        .insert(schema.baskets)
        .values({
          id: "b2",
          runId,
          providerBasketId: "p2",
          totalPence: 0,
          itemCount: 0,
          idempotencyKey: "shared-key",
        })
        .run();
    } catch (err) {
      captured = err;
    }
    expect(captured).toBeInstanceOf(Error);
    const cause = (captured as Error & { cause?: Error }).cause;
    expect(cause?.message ?? "").toMatch(/UNIQUE/i);
  });
});
