import { describe, expect, it } from "vitest";

import { type Basket, type ProductCandidate } from "@/lib/domain/types";
import { type UserProfile } from "@/lib/policy/user-profile";
import { type PolicyContext, validateBasket } from "@/lib/policy/validate";

const basicProfile: UserProfile = {
  userId: "u",
  maxBudgetPence: 5_000,
  allergens: ["nuts"],
  dietary: ["vegetarian"],
};

function makeCandidate(over: Partial<ProductCandidate> = {}): ProductCandidate {
  return {
    id: "cand_1",
    intentId: "intent_1",
    providerProductId: "prov_1",
    name: "Whole Milk 2L",
    pricePence: 245,
    unit: "litre",
    thumbnailUrl: null,
    score: 0.95,
    isSelected: true,
    ...over,
  };
}

function makeBasket(over: Partial<Basket> = {}): Basket {
  return {
    id: "b_1",
    runId: "r_1",
    providerBasketId: "p_1",
    totalPence: 1_000,
    itemCount: 1,
    idempotencyKey: "idem_1",
    items: [
      { id: "bi_1", basketId: "b_1", candidateId: "cand_1", quantity: 1, linePricePence: 1_000 },
    ],
    ...over,
  };
}

function ctx(
  basket: Basket,
  candidate: ProductCandidate,
  profile: UserProfile = basicProfile,
): PolicyContext {
  return {
    basket,
    candidates: new Map([[candidate.id, candidate]]),
    profile,
  };
}

describe("validateBasket", () => {
  it("returns ok=true when nothing flags", () => {
    const result = validateBasket(ctx(makeBasket(), makeCandidate()));
    expect(result.ok).toBe(true);
    expect(result.flags).toHaveLength(0);
  });

  it("flags BUDGET_EXCEEDED when total > max", () => {
    const result = validateBasket(ctx(makeBasket({ totalPence: 6_000 }), makeCandidate()));
    expect(result.ok).toBe(false);
    expect(result.flags[0]?.kind).toBe("BUDGET_EXCEEDED");
  });

  it("flags ALLERGEN_DETECTED when candidate name contains an allergen", () => {
    const result = validateBasket(ctx(makeBasket(), makeCandidate({ name: "Mixed Nuts 200g" })));
    expect(result.flags.some((f) => f.kind === "ALLERGEN_DETECTED")).toBe(true);
  });

  it("flags DIETARY_VIOLATION for vegetarian + chicken", () => {
    const result = validateBasket(
      ctx(makeBasket(), makeCandidate({ name: "British Chicken Breast 500g" })),
    );
    expect(result.flags.some((f) => f.kind === "DIETARY_VIOLATION")).toBe(true);
  });

  it("flags LOW_CONFIDENCE_MATCH when score < 0.6", () => {
    const result = validateBasket(ctx(makeBasket(), makeCandidate({ score: 0.4 })));
    expect(result.flags.some((f) => f.kind === "LOW_CONFIDENCE_MATCH")).toBe(true);
  });

  it("requiresExplicitApproval = true whenever any flag fires", () => {
    const result = validateBasket(ctx(makeBasket({ totalPence: 6_000 }), makeCandidate()));
    expect(result.requiresExplicitApproval).toBe(true);
  });
});
