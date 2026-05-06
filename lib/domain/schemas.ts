import { z } from "zod";

import {
  CHECKOUT_STATUSES,
  EVENT_STATUSES,
  PRODUCT_CATEGORIES,
  RUN_STATUSES,
  WORKFLOW_STEPS,
} from "@/lib/db/schema";

// enums

export const RunStatusSchema = z.enum(RUN_STATUSES);
export const WorkflowStepSchema = z.enum(WORKFLOW_STEPS);
export const EventStatusSchema = z.enum(EVENT_STATUSES);
export const CheckoutStatusSchema = z.enum(CHECKOUT_STATUSES);
export const ProductCategorySchema = z.enum(PRODUCT_CATEGORIES);

// domain objects

export const ProductIntentSchema = z.object({
  id: z.string(),
  runId: z.string(),
  originalText: z.string().min(1),
  canonicalName: z.string().min(1),
  quantity: z.number().nonnegative(),
  unit: z.string(),
  category: ProductCategorySchema,
  confidence: z.number().min(0).max(1),
  needsClarification: z.boolean(),
  clarificationReason: z.string().nullable(),
});

export const ProductCandidateSchema = z.object({
  id: z.string(),
  intentId: z.string(),
  providerProductId: z.string(),
  name: z.string(),
  pricePence: z.number().int().nonnegative(),
  unit: z.string(),
  thumbnailUrl: z.string().url().nullable(),
  score: z.number().min(0).max(1),
  isSelected: z.boolean(),
});

export const BasketItemSchema = z.object({
  id: z.string(),
  basketId: z.string(),
  candidateId: z.string(),
  quantity: z.number().positive(),
  linePricePence: z.number().int().nonnegative(),
});

export const BasketSchema = z.object({
  id: z.string(),
  runId: z.string(),
  providerBasketId: z.string(),
  totalPence: z.number().int().nonnegative(),
  itemCount: z.number().int().nonnegative(),
  idempotencyKey: z.string(),
  items: z.array(BasketItemSchema),
});

// policy

export const PolicyFlagSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("BUDGET_EXCEEDED"),
    maxPence: z.number().int().nonnegative(),
    actualPence: z.number().int().nonnegative(),
  }),
  z.object({
    kind: z.literal("ALLERGEN_DETECTED"),
    itemId: z.string(),
    allergen: z.string(),
  }),
  z.object({
    kind: z.literal("DIETARY_VIOLATION"),
    itemId: z.string(),
    rule: z.enum(["vegan", "vegetarian", "gluten_free", "halal"]),
  }),
  z.object({
    kind: z.literal("LOW_CONFIDENCE_MATCH"),
    itemId: z.string(),
    confidence: z.number().min(0).max(1),
    threshold: z.literal(0.6),
  }),
  z.object({
    kind: z.literal("UNAVAILABLE_PRODUCT"),
    itemId: z.string(),
    substitution: ProductCandidateSchema.optional(),
  }),
  z.object({
    kind: z.literal("SUBSTITUTION_APPLIED"),
    itemId: z.string(),
    original: z.string(),
    substitute: z.string(),
  }),
]);

export const BasketPolicyResultSchema = z.object({
  ok: z.boolean(),
  totalCostPence: z.number().int().nonnegative(),
  flags: z.array(PolicyFlagSchema),
  requiresExplicitApproval: z.boolean(),
});

// approval / checkout

export const ApprovalDecisionSchema = z.object({
  approved: z.boolean(),
  decidedBy: z.string(),
  reason: z.string().nullable(),
  decidedAt: z.string().datetime(),
});

export const UserConsentSchema = z.object({
  termsAccepted: z.boolean(),
  privacyAccepted: z.boolean(),
  marketingOptIn: z.boolean().default(false),
  acceptedAt: z.string().datetime(),
});

export const CheckoutSessionSchema = z.object({
  id: z.string(),
  basketId: z.string(),
  providerSessionId: z.string(),
  status: CheckoutStatusSchema,
  consent: UserConsentSchema,
  approvalTokenId: z.string().nullable(),
  finalizedAt: z.string().datetime().nullable(),
});

// provider request shapes

export const ProductQuerySchema = z.object({
  canonicalName: z.string(),
  unit: z.string().optional(),
  category: ProductCategorySchema.optional(),
  limit: z.number().int().positive().max(20).default(10),
});

export const BasketItemDraftSchema = z.object({
  candidateId: z.string(),
  quantity: z.number().positive(),
});

export const BasketPatchSchema = z.object({
  basketId: z.string(),
  add: z.array(BasketItemDraftSchema).optional(),
  remove: z.array(z.string()).optional(), // candidateIds to remove
});

// provider responses

export const ProductMatchSchema = z.object({
  providerProductId: z.string(),
  name: z.string(),
  pricePence: z.number().int().nonnegative(),
  unit: z.string(),
  thumbnailUrl: z.string().url().nullable(),
  score: z.number().min(0).max(1),
});

export const OrderStatusSchema = z.object({
  sessionId: z.string(),
  basketId: z.string(),
  status: CheckoutStatusSchema,
  finalizedAt: z.string().datetime().nullable(),
});
