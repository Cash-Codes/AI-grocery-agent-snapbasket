import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { z } from "zod";

import catalogJson from "./catalog.json" with { type: "json" };
import type { CommerceProvider, CreateBasketInput, CreateCheckoutSessionInput } from "./types";

import { getDb } from "@/lib/db/client";
import { basketItems, baskets, checkoutSessions, productCandidates } from "@/lib/db/schema";
import { ProductCategorySchema } from "@/lib/domain/schemas";
import type {
  Basket,
  CheckoutSession,
  OrderStatus,
  ProductMatch,
  ProductQuery,
} from "@/lib/domain/types";

const CatalogEntrySchema = z.object({
  providerProductId: z.string(),
  name: z.string(),
  category: ProductCategorySchema,
  pricePence: z.number().int().nonnegative(),
  unit: z.string(),
  thumbnailUrl: z.string().url().nullable(),
  searchTokens: z.array(z.string()).min(1),
});

type CatalogEntry = z.infer<typeof CatalogEntrySchema>;

// validate the bundled catalog at module load with fail fast on malformed data.
const CATALOG: readonly CatalogEntry[] = z.array(CatalogEntrySchema).parse(catalogJson);

function tokenScore(query: string, tokens: readonly string[]): number {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return 0;
  let best = 0;
  for (const token of tokens) {
    const t = token.toLowerCase();
    if (t === q) return 1; // exact match wins immediately
    if (t.includes(q) || q.includes(t)) {
      best = Math.max(best, 0.5);
    }
  }
  return best;
}

export class MockUcpCommerceProvider implements CommerceProvider {
  readonly name = "mock-ucp";

  async searchProducts(q: ProductQuery): Promise<ProductMatch[]> {
    const limit = q.limit ?? 10;
    const filtered = q.category
      ? CATALOG.filter((entry) => entry.category === q.category)
      : CATALOG;

    const scored = filtered
      .map((entry) => ({
        entry,
        score: tokenScore(q.canonicalName, entry.searchTokens),
      }))
      .filter((row) => row.score > 0)
      .sort((a, b) => {
        // Primary, score descending, for tiebreak - providerProductId alphabetical so deterministic
        if (b.score !== a.score) return b.score - a.score;
        return a.entry.providerProductId.localeCompare(b.entry.providerProductId);
      })
      .slice(0, limit);

    return scored.map((row) => ({
      providerProductId: row.entry.providerProductId,
      name: row.entry.name,
      pricePence: row.entry.pricePence,
      unit: row.entry.unit,
      thumbnailUrl: row.entry.thumbnailUrl,
      score: row.score,
    }));
  }

  async createBasket(input: CreateBasketInput): Promise<Basket> {
    const db = getDb();

    // Look up existing basket by the unique idempotency key.
    const existing = db
      .select()
      .from(baskets)
      .where(eq(baskets.idempotencyKey, input.idempotencyKey))
      .all();
    if (existing.length > 0) {
      return this.hydrateBasket(existing[0]!.id);
    }

    // resolve each candidate so we can compute totals
    const candidates = input.items.map((draft) => {
      const rows = db
        .select()
        .from(productCandidates)
        .where(eq(productCandidates.id, draft.candidateId))
        .all();
      const candidate = rows[0];
      if (!candidate) {
        throw new Error(
          `MockUcpCommerceProvider.createBasket: candidate ${draft.candidateId} not found`,
        );
      }
      return { draft, candidate };
    });

    const totalPence = candidates.reduce(
      (sum, { draft, candidate }) => sum + draft.quantity * candidate.pricePence,
      0,
    );
    const itemCount = candidates.length;

    const basketId = `basket_${randomUUID()}`;
    const providerBasketId = `prov_basket_${randomUUID()}`;

    db.insert(baskets)
      .values({
        id: basketId,
        runId: input.runId,
        providerBasketId,
        totalPence: Math.round(totalPence),
        itemCount,
        idempotencyKey: input.idempotencyKey,
      })
      .run();

    for (const { draft, candidate } of candidates) {
      db.insert(basketItems)
        .values({
          id: `bi_${randomUUID()}`,
          basketId,
          candidateId: draft.candidateId,
          quantity: draft.quantity,
          linePricePence: Math.round(draft.quantity * candidate.pricePence),
        })
        .run();
    }

    return this.hydrateBasket(basketId);
  }

  async updateBasket(_input: never): Promise<Basket> {
    throw new Error("MockUcpCommerceProvider.updateBasket: not implemented");
  }

  async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CheckoutSession> {
    const db = getDb();

    // Idempotency at the checkout layer, same idempotencyKey + same basket - same session.
    const existing = db
      .select()
      .from(checkoutSessions)
      .where(eq(checkoutSessions.basketId, input.basketId))
      .all();
    const matched = existing.find(
      (s) => s.providerSessionId === input.idempotencyKey || s.id === input.idempotencyKey,
    );
    if (matched) {
      return this.toCheckoutSession(matched);
    }

    const id = `cs_${randomUUID()}`;
    const providerSessionId = input.idempotencyKey; // reuse the key as the provider's id for the mock

    db.insert(checkoutSessions)
      .values({
        id,
        basketId: input.basketId,
        providerSessionId,
        consentJson: JSON.stringify(input.consent),
      })
      .run();

    const inserted = db.select().from(checkoutSessions).where(eq(checkoutSessions.id, id)).all();
    return this.toCheckoutSession(inserted[0]!);
  }

  async getOrderStatus(sessionId: string): Promise<OrderStatus> {
    const db = getDb();
    const rows = db.select().from(checkoutSessions).where(eq(checkoutSessions.id, sessionId)).all();
    const session = rows[0];
    if (!session) {
      throw new Error(`MockUcpCommerceProvider.getOrderStatus: session ${sessionId} not found`);
    }
    return {
      sessionId: session.id,
      basketId: session.basketId,
      status: session.status,
      finalizedAt: session.finalizedAt ? session.finalizedAt.toISOString() : null,
    };
  }

  // private helpers

  private hydrateBasket(basketId: string): Basket {
    const db = getDb();
    const basketRows = db.select().from(baskets).where(eq(baskets.id, basketId)).all();
    const row = basketRows[0];
    if (!row) {
      throw new Error(`MockUcpCommerceProvider.hydrateBasket: basket ${basketId} not found`);
    }
    const itemRows = db.select().from(basketItems).where(eq(basketItems.basketId, basketId)).all();
    return {
      id: row.id,
      runId: row.runId,
      providerBasketId: row.providerBasketId,
      totalPence: row.totalPence,
      itemCount: row.itemCount,
      idempotencyKey: row.idempotencyKey,
      items: itemRows.map((it) => ({
        id: it.id,
        basketId: it.basketId,
        candidateId: it.candidateId,
        quantity: it.quantity,
        linePricePence: it.linePricePence,
      })),
    };
  }

  private toCheckoutSession(row: typeof checkoutSessions.$inferSelect): CheckoutSession {
    return {
      id: row.id,
      basketId: row.basketId,
      providerSessionId: row.providerSessionId,
      status: row.status,
      consent: JSON.parse(row.consentJson) as import("@/lib/domain/types").UserConsent,
      approvalTokenId: row.approvalTokenId,
      finalizedAt: row.finalizedAt ? row.finalizedAt.toISOString() : null,
    };
  }
}
