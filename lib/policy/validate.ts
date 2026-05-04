import { type UserProfile } from "./user-profile";

import type { Basket, BasketPolicyResult, PolicyFlag, ProductCandidate } from "@/lib/domain/types";

const LOW_CONFIDENCE_THRESHOLD = 0.6;

export interface PolicyContext {
  basket: Basket;
  candidates: Map<string, ProductCandidate>; // candidateId - ProductCandidate
  profile: UserProfile;
}

export function validateBasket(ctx: PolicyContext): BasketPolicyResult {
  const flags: PolicyFlag[] = [];

  // BUDGET_EXCEEDED
  if (ctx.basket.totalPence > ctx.profile.maxBudgetPence) {
    flags.push({
      kind: "BUDGET_EXCEEDED",
      maxPence: ctx.profile.maxBudgetPence,
      actualPence: ctx.basket.totalPence,
    });
  }

  // Per item checks
  for (const item of ctx.basket.items) {
    const candidate = ctx.candidates.get(item.candidateId);
    if (!candidate) continue;

    // LOW_CONFIDENCE_MATCH
    if (candidate.score < LOW_CONFIDENCE_THRESHOLD) {
      flags.push({
        kind: "LOW_CONFIDENCE_MATCH",
        itemId: item.id,
        confidence: candidate.score,
        threshold: 0.6,
      });
    }

    // ALLERGEN_DETECTED - substring match against the candidate name
    for (const allergen of ctx.profile.allergens) {
      if (candidate.name.toLowerCase().includes(allergen.toLowerCase())) {
        flags.push({ kind: "ALLERGEN_DETECTED", itemId: item.id, allergen });
      }
    }

    // DIETARY_VIOLATION - substring against name
    for (const rule of ctx.profile.dietary) {
      if (containsDietaryViolation(candidate.name, rule)) {
        flags.push({ kind: "DIETARY_VIOLATION", itemId: item.id, rule });
      }
    }
  }

  const ok = flags.length === 0;
  // ANY flag triggers explicit approval requirement
  const requiresExplicitApproval = flags.length > 0;

  return {
    ok,
    totalCostPence: ctx.basket.totalPence,
    flags,
    requiresExplicitApproval,
  };
}

const VEGETARIAN_FORBIDDEN = [
  "chicken",
  "beef",
  "pork",
  "salmon",
  "tuna",
  "fish",
  "lamb",
  "bacon",
  "ham",
];
const VEGAN_FORBIDDEN = [
  ...VEGETARIAN_FORBIDDEN,
  "milk",
  "cheese",
  "butter",
  "cream",
  "egg",
  "yogurt",
  "yoghurt",
];
const GLUTEN_FORBIDDEN = ["bread", "pasta", "flour", "biscuits", "cookies", "cereal", "noodles"];
const HALAL_FORBIDDEN = ["pork", "bacon", "ham"];

function containsDietaryViolation(
  candidateName: string,
  rule: "vegan" | "vegetarian" | "gluten_free" | "halal",
): boolean {
  const lc = candidateName.toLowerCase();
  const list =
    rule === "vegan"
      ? VEGAN_FORBIDDEN
      : rule === "vegetarian"
        ? VEGETARIAN_FORBIDDEN
        : rule === "gluten_free"
          ? GLUTEN_FORBIDDEN
          : HALAL_FORBIDDEN;
  return list.some((forbidden) => lc.includes(forbidden));
}
