import { sql, type InferSelectModel } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// enums (TS side, persisted as text)

export const RUN_STATUSES = [
  "PENDING",
  "RUNNING",
  "AWAITING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "TIMED_OUT",
  "COMPLETED",
  "FAILED",
] as const;

export const WORKFLOW_STEPS = [
  "ingestImage",
  "extractRawTextFromImage",
  "parseGroceryIntent",
  "normalizeItems",
  "enrichItems",
  "matchProducts",
  "buildBasket",
  "validateBasketPolicy",
  "requireHumanApproval",
  "finalizeMockCheckout",
] as const;

export const EVENT_STATUSES = ["started", "succeeded", "failed", "retrying"] as const;

export const CHECKOUT_STATUSES = ["PENDING", "COMPLETED", "FAILED"] as const;

export const PRODUCT_CATEGORIES = [
  "dairy",
  "produce",
  "pantry",
  "household",
  "beverages",
  "frozen",
  "bakery",
  "meat",
  "other",
] as const;

const nowMs = sql`(unixepoch() * 1000)`;

// tables

export const images = sqliteTable(
  "images",
  {
    id: text("id").primaryKey(),
    sha256: text("sha256").notNull(),
    mime: text("mime").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storagePath: text("storage_path").notNull(),
    uploadedAt: integer("uploaded_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  },
  (t) => [uniqueIndex("images_sha256_idx").on(t.sha256)],
);

export const runs = sqliteTable(
  "runs",
  {
    id: text("id").primaryKey(),
    imageId: text("image_id")
      .notNull()
      .references(() => images.id),
    userId: text("user_id").notNull(),
    status: text("status", { enum: RUN_STATUSES }).notNull().default("PENDING"),
    triggerRunId: text("trigger_run_id"),
    approvalTokenId: text("approval_token_id"),
    correlationId: text("correlation_id").notNull(),
    failureStep: text("failure_step", { enum: WORKFLOW_STEPS }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  },
  (t) => [index("runs_correlation_idx").on(t.correlationId), index("runs_status_idx").on(t.status)],
);

export const rawExtractions = sqliteTable("raw_extractions", {
  id: text("id").primaryKey(),
  imageId: text("image_id")
    .notNull()
    .references(() => images.id),
  providerName: text("provider_name").notNull(),
  rawText: text("raw_text").notNull(),
  confidence: real("confidence").notNull(),
  rawProviderResponseJson: text("raw_provider_response_json"),
  extractedAt: integer("extracted_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
});

export const productIntents = sqliteTable(
  "product_intents",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id),
    originalText: text("original_text").notNull(),
    canonicalName: text("canonical_name").notNull(),
    quantity: real("quantity").notNull(),
    unit: text("unit").notNull(),
    category: text("category", { enum: PRODUCT_CATEGORIES }).notNull(),
    confidence: real("confidence").notNull(),
    needsClarification: integer("needs_clarification", { mode: "boolean" })
      .notNull()
      .default(false),
    clarificationReason: text("clarification_reason"),
  },
  (t) => [index("product_intents_run_idx").on(t.runId)],
);

export const productCandidates = sqliteTable(
  "product_candidates",
  {
    id: text("id").primaryKey(),
    intentId: text("intent_id")
      .notNull()
      .references(() => productIntents.id),
    providerProductId: text("provider_product_id").notNull(),
    name: text("name").notNull(),
    pricePence: integer("price_pence").notNull(),
    unit: text("unit").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    score: real("score").notNull(),
    isSelected: integer("is_selected", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("product_candidates_intent_idx").on(t.intentId)],
);

export const baskets = sqliteTable(
  "baskets",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id),
    providerBasketId: text("provider_basket_id").notNull(),
    totalPence: integer("total_pence").notNull(),
    itemCount: integer("item_count").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  },
  (t) => [
    uniqueIndex("baskets_run_idx").on(t.runId),
    uniqueIndex("baskets_idem_idx").on(t.idempotencyKey),
  ],
);

export const basketItems = sqliteTable(
  "basket_items",
  {
    id: text("id").primaryKey(),
    basketId: text("basket_id")
      .notNull()
      .references(() => baskets.id),
    candidateId: text("candidate_id")
      .notNull()
      .references(() => productCandidates.id),
    quantity: real("quantity").notNull(),
    linePricePence: integer("line_price_pence").notNull(),
  },
  (t) => [index("basket_items_basket_idx").on(t.basketId)],
);

export const policyResults = sqliteTable(
  "policy_results",
  {
    id: text("id").primaryKey(),
    basketId: text("basket_id")
      .notNull()
      .references(() => baskets.id),
    ok: integer("ok", { mode: "boolean" }).notNull(),
    requiresExplicitApproval: integer("requires_explicit_approval", { mode: "boolean" })
      .notNull()
      .default(false),
    totalCostPence: integer("total_cost_pence").notNull(),
    flagsJson: text("flags_json").notNull().default("[]"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  },
  (t) => [uniqueIndex("policy_results_basket_idx").on(t.basketId)],
);

export const checkoutSessions = sqliteTable(
  "checkout_sessions",
  {
    id: text("id").primaryKey(),
    basketId: text("basket_id")
      .notNull()
      .references(() => baskets.id),
    providerSessionId: text("provider_session_id").notNull(),
    status: text("status", { enum: CHECKOUT_STATUSES }).notNull().default("PENDING"),
    consentJson: text("consent_json").notNull(),
    approvalTokenId: text("approval_token_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
    finalizedAt: integer("finalized_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("checkout_sessions_basket_idx").on(t.basketId)],
);

export const workflowEvents = sqliteTable(
  "workflow_events",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id),
    step: text("step", { enum: WORKFLOW_STEPS }).notNull(),
    status: text("status", { enum: EVENT_STATUSES }).notNull(),
    attempt: integer("attempt").notNull().default(1),
    correlationId: text("correlation_id").notNull(),
    payloadJson: text("payload_json"),
    errorJson: text("error_json"),
    timestamp: integer("timestamp", { mode: "timestamp_ms" }).notNull().default(nowMs),
  },
  (t) => [
    index("workflow_events_run_idx").on(t.runId),
    index("workflow_events_run_ts_idx").on(t.runId, t.timestamp),
  ],
);

export const userConsents = sqliteTable("user_consents", {
  id: text("id").primaryKey(),
  runId: text("run_id")
    .notNull()
    .references(() => runs.id),
  decidedBy: text("decided_by").notNull(),
  approved: integer("approved", { mode: "boolean" }).notNull(),
  reason: text("reason"),
  decidedAt: integer("decided_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
});

// inferred row types

export type ImageRow = InferSelectModel<typeof images>;
export type RunRow = InferSelectModel<typeof runs>;
export type RawExtractionRow = InferSelectModel<typeof rawExtractions>;
export type ProductIntentRow = InferSelectModel<typeof productIntents>;
export type ProductCandidateRow = InferSelectModel<typeof productCandidates>;
export type BasketRow = InferSelectModel<typeof baskets>;
export type BasketItemRow = InferSelectModel<typeof basketItems>;
export type PolicyResultRow = InferSelectModel<typeof policyResults>;
export type CheckoutSessionRow = InferSelectModel<typeof checkoutSessions>;
export type WorkflowEventRow = InferSelectModel<typeof workflowEvents>;
export type UserConsentRow = InferSelectModel<typeof userConsents>;
