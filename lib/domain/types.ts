import type { z } from "zod";

import type {
  ApprovalDecisionSchema,
  BasketItemDraftSchema,
  BasketItemSchema,
  BasketPatchSchema,
  BasketPolicyResultSchema,
  BasketSchema,
  CheckoutSessionSchema,
  CheckoutStatusSchema,
  EventStatusSchema,
  OrderStatusSchema,
  PolicyFlagSchema,
  ProductCandidateSchema,
  ProductCategorySchema,
  ProductIntentSchema,
  ProductMatchSchema,
  ProductQuerySchema,
  RunStatusSchema,
  UserConsentSchema,
  WorkflowStepSchema,
} from "@/lib/domain/schemas";

export type RunStatus = z.infer<typeof RunStatusSchema>;
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;
export type EventStatus = z.infer<typeof EventStatusSchema>;
export type CheckoutStatus = z.infer<typeof CheckoutStatusSchema>;
export type ProductCategory = z.infer<typeof ProductCategorySchema>;

export type ProductIntent = z.infer<typeof ProductIntentSchema>;
export type ProductCandidate = z.infer<typeof ProductCandidateSchema>;
export type BasketItem = z.infer<typeof BasketItemSchema>;
export type Basket = z.infer<typeof BasketSchema>;

export type PolicyFlag = z.infer<typeof PolicyFlagSchema>;
export type BasketPolicyResult = z.infer<typeof BasketPolicyResultSchema>;

export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;
export type UserConsent = z.infer<typeof UserConsentSchema>;
export type CheckoutSession = z.infer<typeof CheckoutSessionSchema>;

export type ProductQuery = z.infer<typeof ProductQuerySchema>;
export type BasketItemDraft = z.infer<typeof BasketItemDraftSchema>;
export type BasketPatch = z.infer<typeof BasketPatchSchema>;

export type ProductMatch = z.infer<typeof ProductMatchSchema>;
export type OrderStatus = z.infer<typeof OrderStatusSchema>;
