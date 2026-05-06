import { randomUUID } from "node:crypto";

import { queue, task } from "@trigger.dev/sdk";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { ensureMigrated, getDb } from "@/lib/db/client";
import { productCandidates, productIntents } from "@/lib/db/schema";
import { emitWorkflowEvent } from "@/lib/observability/events";
import { withSpan } from "@/lib/observability/otel";
import { commerceProvider } from "@/lib/providers/commerce";
import { maybeInjectFault } from "@/lib/trigger/fault-injection";
import { STANDARD_RETRY } from "@/lib/trigger/retry";

const InputSchema = z.object({
  runId: z.string(),
  correlationId: z.string(),
  intentId: z.string(),
});

const OutputSchema = z.object({
  intentId: z.string(),
  candidateIds: z.array(z.string()),
});

export const matchProductsQueue = queue({
  name: "match-products",
  concurrencyLimit: 4,
});

export const matchProducts = task({
  id: "snapbasket.matchProducts",
  queue: matchProductsQueue,
  retry: STANDARD_RETRY,
  run: async (raw: unknown, { ctx }) => {
    const input = InputSchema.parse(raw);
    const attempt = ctx.attempt.number;
    return withSpan(
      "matchProducts",
      {
        correlationId: input.correlationId,
        runId: input.runId,
        step: "matchProducts",
        attempt,
        intentId: input.intentId,
      },
      async () => {
        await emitWorkflowEvent({
          runId: input.runId,
          step: "matchProducts",
          status: attempt > 1 ? "retrying" : "started",
          attempt,
          correlationId: input.correlationId,
          payload: { intentId: input.intentId },
        });

        maybeInjectFault("matchProducts", attempt);

        await ensureMigrated();
        const db = getDb();
        const intent = (
          await db.select().from(productIntents).where(eq(productIntents.id, input.intentId)).all()
        )[0];
        if (!intent) {
          throw new Error(`matchProducts: intent ${input.intentId} not found`);
        }

        // Don't pass intent.category - the parser's inferred category is often
        // wrong (eg., "tomato paste" infers "produce" because of the "tomato"
        // word, but the matching product lives in "pantry"). The token scorer
        // and 0.55 acceptance threshold handle relevance correctly across
        // categories without the filter.
        const matches = await commerceProvider.searchProducts({
          canonicalName: intent.canonicalName,
          limit: 5,
        });

        const candidateIds: string[] = [];
        for (const match of matches) {
          const candidateId = `cand_${randomUUID()}`;
          await db
            .insert(productCandidates)
            .values({
              id: candidateId,
              intentId: input.intentId,
              providerProductId: match.providerProductId,
              name: match.name,
              pricePence: match.pricePence,
              unit: match.unit,
              thumbnailUrl: match.thumbnailUrl,
              score: match.score,
              isSelected: candidateIds.length === 0, // top match is selected by default
            })
            .run();
          candidateIds.push(candidateId);
        }

        const output = OutputSchema.parse({ intentId: input.intentId, candidateIds });

        await emitWorkflowEvent({
          runId: input.runId,
          step: "matchProducts",
          status: "succeeded",
          attempt,
          correlationId: input.correlationId,
          payload: { intentId: input.intentId, candidateCount: candidateIds.length },
        });
        return output;
      },
    );
  },
});
