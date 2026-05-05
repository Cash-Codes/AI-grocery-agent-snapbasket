import { task } from "@trigger.dev/sdk";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db/client";
import { productCandidates, productIntents, runs } from "@/lib/db/schema";
import { emitWorkflowEvent } from "@/lib/observability/events";
import { withSpan } from "@/lib/observability/otel";
import { commerceProvider } from "@/lib/providers/commerce";
import { SHORT_RETRY } from "@/lib/trigger/retry";

const InputSchema = z.object({
  runId: z.string(),
  correlationId: z.string(),
});

const OutputSchema = z.object({
  basketId: z.string(),
  totalPence: z.number(),
});

export const buildBasket = task({
  id: "snapbasket.buildBasket",
  retry: SHORT_RETRY,
  run: async (raw: unknown, { ctx }) => {
    const input = InputSchema.parse(raw);
    const attempt = ctx.attempt.number;
    return withSpan(
      "buildBasket",
      {
        correlationId: input.correlationId,
        runId: input.runId,
        step: "buildBasket",
        attempt,
      },
      async () => {
        emitWorkflowEvent({
          runId: input.runId,
          step: "buildBasket",
          status: "started",
          attempt,
          correlationId: input.correlationId,
        });

        const db = getDb();
        const run = db.select().from(runs).where(eq(runs.id, input.runId)).all()[0];
        if (!run) throw new Error(`buildBasket: run ${input.runId} not found`);

        const intentRows = db
          .select({ id: productIntents.id })
          .from(productIntents)
          .where(eq(productIntents.runId, input.runId))
          .all();
        const intentIds = intentRows.map((r) => r.id);

        const selected =
          intentIds.length === 0
            ? []
            : db
                .select({
                  id: productCandidates.id,
                  intentId: productCandidates.intentId,
                })
                .from(productCandidates)
                .where(
                  and(
                    inArray(productCandidates.intentId, intentIds),
                    eq(productCandidates.isSelected, true),
                  ),
                )
                .all();

        const basket = await commerceProvider.createBasket({
          userId: run.userId,
          runId: input.runId,
          // Deterministic idempotency key, workflow retry of buildBasket returns the same basket.
          idempotencyKey: `idem_basket_${input.runId}`,
          items: selected.map((c) => ({ candidateId: c.id, quantity: 1 })),
        });

        const output = OutputSchema.parse({ basketId: basket.id, totalPence: basket.totalPence });

        emitWorkflowEvent({
          runId: input.runId,
          step: "buildBasket",
          status: "succeeded",
          attempt,
          correlationId: input.correlationId,
          payload: output,
        });
        return output;
      },
    );
  },
});
