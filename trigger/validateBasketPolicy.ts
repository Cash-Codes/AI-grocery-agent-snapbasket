import { randomUUID } from "node:crypto";

import { task } from "@trigger.dev/sdk";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { ensureMigrated, getDb } from "@/lib/db/client";
import { basketItems, baskets, policyResults, productCandidates } from "@/lib/db/schema";
import { emitWorkflowEvent } from "@/lib/observability/events";
import { withSpan } from "@/lib/observability/otel";
import { getUserProfile, validateBasket } from "@/lib/policy";

const InputSchema = z.object({
  runId: z.string(),
  correlationId: z.string(),
  basketId: z.string(),
});

const OutputSchema = z.object({
  policyResultId: z.string(),
  ok: z.boolean(),
  requiresExplicitApproval: z.boolean(),
  flagCount: z.number(),
});

export const validateBasketPolicy = task({
  id: "snapbasket.validateBasketPolicy",
  retry: { maxAttempts: 1 },
  run: async (raw: unknown, { ctx }) => {
    const input = InputSchema.parse(raw);
    const attempt = ctx.attempt.number;
    return withSpan(
      "validateBasketPolicy",
      {
        correlationId: input.correlationId,
        runId: input.runId,
        step: "validateBasketPolicy",
        attempt,
      },
      async () => {
        await emitWorkflowEvent({
          runId: input.runId,
          step: "validateBasketPolicy",
          status: "started",
          attempt,
          correlationId: input.correlationId,
        });

        await ensureMigrated();
        const db = getDb();
        const basketRow = (
          await db.select().from(baskets).where(eq(baskets.id, input.basketId)).all()
        )[0];
        if (!basketRow) throw new Error(`validateBasketPolicy: basket ${input.basketId} not found`);

        const itemRows = await db
          .select()
          .from(basketItems)
          .where(eq(basketItems.basketId, input.basketId))
          .all();
        const candidateIds = itemRows.map((it) => it.candidateId);
        const candidateRows =
          candidateIds.length > 0
            ? await db
                .select()
                .from(productCandidates)
                .where(inArray(productCandidates.id, candidateIds))
                .all()
            : [];

        const candidateMap = new Map(
          candidateRows.map(
            (c) =>
              [
                c.id,
                {
                  id: c.id,
                  intentId: c.intentId,
                  providerProductId: c.providerProductId,
                  name: c.name,
                  pricePence: c.pricePence,
                  unit: c.unit,
                  thumbnailUrl: c.thumbnailUrl,
                  score: c.score,
                  isSelected: c.isSelected,
                },
              ] as const,
          ),
        );

        const basket = {
          id: basketRow.id,
          runId: basketRow.runId,
          providerBasketId: basketRow.providerBasketId,
          totalPence: basketRow.totalPence,
          itemCount: basketRow.itemCount,
          idempotencyKey: basketRow.idempotencyKey,
          items: itemRows.map((it) => ({
            id: it.id,
            basketId: it.basketId,
            candidateId: it.candidateId,
            quantity: it.quantity,
            linePricePence: it.linePricePence,
          })),
        };

        const profile = getUserProfile("user_default");
        const result = validateBasket({ basket, candidates: candidateMap, profile });

        const policyResultId = `pol_${randomUUID()}`;
        await db
          .insert(policyResults)
          .values({
            id: policyResultId,
            basketId: basketRow.id,
            ok: result.ok,
            requiresExplicitApproval: result.requiresExplicitApproval,
            totalCostPence: result.totalCostPence,
            flagsJson: JSON.stringify(result.flags),
          })
          .run();

        const output = OutputSchema.parse({
          policyResultId,
          ok: result.ok,
          requiresExplicitApproval: result.requiresExplicitApproval,
          flagCount: result.flags.length,
        });

        await emitWorkflowEvent({
          runId: input.runId,
          step: "validateBasketPolicy",
          status: "succeeded",
          attempt,
          correlationId: input.correlationId,
          payload: { ok: result.ok, flagCount: result.flags.length },
        });
        return output;
      },
    );
  },
});
