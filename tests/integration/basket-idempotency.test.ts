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
let db: ReturnType<typeof drizzle<typeof schema>>;

beforeAll(async () => {
  tempDir = mkdtempSync(path.join(tmpdir(), "snapbasket-basket-"));
  dbPath = path.join(tempDir, "test.db");
  client = createClient({ url: `file:${dbPath}` });
  db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });

  // Point the production client at this test DB so MockUcpCommerceProvider.getDb()
  // operates on it. Must be set BEFORE the dynamic import of the commerce provider.
  process.env.DATABASE_URL = dbPath;

  // Seed FOUR distinct runs - one per test scope - so each test respects the
  // baskets.runId UNIQUE constraint.
  const seedRun = async (suffix: string) => {
    await db
      .insert(schema.images)
      .values({
        id: `img_${suffix}`,
        sha256: `sha_${suffix}`,
        mime: "image/png",
        sizeBytes: 1,
        storagePath: `/tmp/${suffix}.png`,
      })
      .run();
    await db
      .insert(schema.runs)
      .values({
        id: `run_${suffix}`,
        imageId: `img_${suffix}`,
        userId: "user_idem",
        correlationId: `corr_${suffix}`,
      })
      .run();
  };
  await seedRun("idem_a");
  await seedRun("idem_b");
  await seedRun("idem_c");
  await seedRun("idem_d");

  // Intent + two candidates for run_idem_a (test 1 picks between them).
  await db
    .insert(schema.productIntents)
    .values({
      id: "intent_a",
      runId: "run_idem_a",
      originalText: "milk",
      canonicalName: "milk",
      quantity: 1,
      unit: "litre",
      category: "dairy",
      confidence: 0.95,
      needsClarification: false,
      clarificationReason: null,
    })
    .run();

  await db
    .insert(schema.productCandidates)
    .values({
      id: "cand_milk_a",
      intentId: "intent_a",
      providerProductId: "prov_dairy_001",
      name: "Whole Milk 2L",
      pricePence: 245,
      unit: "litre",
      thumbnailUrl: null,
      score: 1,
      isSelected: true,
    })
    .run();

  await db
    .insert(schema.productCandidates)
    .values({
      id: "cand_milk_b",
      intentId: "intent_a",
      providerProductId: "prov_dairy_002",
      name: "Semi-Skimmed Milk 2L",
      pricePence: 230,
      unit: "litre",
      thumbnailUrl: null,
      score: 1,
      isSelected: false,
    })
    .run();

  // Intent + candidate for run_idem_b (test 2's second basket).
  await db
    .insert(schema.productIntents)
    .values({
      id: "intent_b",
      runId: "run_idem_b",
      originalText: "milk",
      canonicalName: "milk",
      quantity: 1,
      unit: "litre",
      category: "dairy",
      confidence: 0.95,
      needsClarification: false,
      clarificationReason: null,
    })
    .run();

  await db
    .insert(schema.productCandidates)
    .values({
      id: "cand_milk_c",
      intentId: "intent_b",
      providerProductId: "prov_dairy_003",
      name: "Oat Milk 1L",
      pricePence: 195,
      unit: "litre",
      thumbnailUrl: null,
      score: 1,
      isSelected: true,
    })
    .run();
});

afterAll(() => {
  client.close();
  rmSync(tempDir, { recursive: true, force: true });
  delete process.env.DATABASE_URL;
});

describe("MockUcpCommerceProvider.createBasket idempotency", () => {
  it("same idempotency key + same run returns the same basket - regardless of input items", async () => {
    const { commerceProvider } = await import("@/lib/providers/commerce");
    const idempotencyKey = "idem_basket_proof";

    const first = await commerceProvider.createBasket({
      userId: "user_idem",
      runId: "run_idem_a",
      idempotencyKey,
      items: [{ candidateId: "cand_milk_a", quantity: 2 }],
    });

    // Call again with the SAME run + SAME key but DIFFERENT items.
    // The mock must return the existing basket (with cand_milk_a), not create a new one.
    const second = await commerceProvider.createBasket({
      userId: "user_idem",
      runId: "run_idem_a",
      idempotencyKey,
      items: [{ candidateId: "cand_milk_b", quantity: 99 }],
    });

    expect(second.id).toBe(first.id);
    expect(second.totalPence).toBe(first.totalPence);
    expect(second.items).toHaveLength(first.items.length);
    expect(second.items[0]?.candidateId).toBe("cand_milk_a");
  });

  it("different runs produce different baskets", async () => {
    const { commerceProvider } = await import("@/lib/providers/commerce");

    // run_idem_a already has a basket from the previous test.
    const a = await commerceProvider.createBasket({
      userId: "user_idem",
      runId: "run_idem_a",
      idempotencyKey: "idem_basket_proof", // same key as test 1 - returns existing
      items: [{ candidateId: "cand_milk_a", quantity: 1 }],
    });

    // A fresh run with a fresh key creates a brand-new basket.
    const b = await commerceProvider.createBasket({
      userId: "user_idem",
      runId: "run_idem_b",
      idempotencyKey: "idem_basket_b",
      items: [{ candidateId: "cand_milk_c", quantity: 1 }],
    });

    expect(b.id).not.toBe(a.id);
    expect(b.runId).toBe("run_idem_b");
  });

  it("the DB UNIQUE index on baskets.idempotencyKey is the actual enforcer", async () => {
    // Direct DB insert (bypassing the provider's early-return logic) into run_idem_c
    // with a fresh idempotencyKey.
    await db
      .insert(schema.baskets)
      .values({
        id: "b_direct_a",
        runId: "run_idem_c",
        providerBasketId: "p_direct_a",
        totalPence: 0,
        itemCount: 0,
        idempotencyKey: "idem_basket_direct",
      })
      .run();

    // A second insert with a DIFFERENT runId (run_idem_d) but the SAME idempotencyKey
    // must throw - proving idempotencyKey uniqueness fires independently of runId.
    // libsql wraps the underlying SQLITE_CONSTRAINT error in a generic "Failed query" message;
    // the original UNIQUE violation surfaces on `.cause.message`.
    let captured: unknown;
    try {
      await db
        .insert(schema.baskets)
        .values({
          id: "b_direct_b",
          runId: "run_idem_d",
          providerBasketId: "p_direct_b",
          totalPence: 0,
          itemCount: 0,
          idempotencyKey: "idem_basket_direct",
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
