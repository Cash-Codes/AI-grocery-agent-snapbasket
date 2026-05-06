import { randomUUID } from "node:crypto";

import { task } from "@trigger.dev/sdk";
import { z } from "zod";

import { ensureMigrated, getDb } from "@/lib/db/client";
import { productIntents } from "@/lib/db/schema";
import { emitWorkflowEvent } from "@/lib/observability/events";
import { withSpan } from "@/lib/observability/otel";
import { SHORT_RETRY } from "@/lib/trigger/retry";

const InputSchema = z.object({
  runId: z.string(),
  correlationId: z.string(),
  intents: z.array(
    z.object({
      originalText: z.string(),
      canonicalName: z.string(),
      quantity: z.number(),
      unit: z.string(),
      category: z.string(),
      confidence: z.number(),
      needsClarification: z.boolean(),
      clarificationReason: z.string().nullable(),
    }),
  ),
});

const OutputSchema = z.object({
  intentIds: z.array(z.string()),
});

export const normalizeItems = task({
  id: "snapbasket.normalizeItems",
  retry: SHORT_RETRY,
  run: async (raw: unknown, { ctx }) => {
    const input = InputSchema.parse(raw);
    const attempt = ctx.attempt.number;
    return withSpan(
      "normalizeItems",
      {
        correlationId: input.correlationId,
        runId: input.runId,
        step: "normalizeItems",
        attempt,
      },
      async () => {
        await emitWorkflowEvent({
          runId: input.runId,
          step: "normalizeItems",
          status: "started",
          attempt,
          correlationId: input.correlationId,
        });

        await ensureMigrated();
        const db = getDb();
        const intentIds: string[] = [];

        for (const intent of input.intents) {
          const id = `intent_${randomUUID()}`;
          await db
            .insert(productIntents)
            .values({
              id,
              runId: input.runId,
              originalText: intent.originalText,
              canonicalName: intent.canonicalName,
              quantity: intent.quantity,
              unit: intent.unit,
              // category cast, caller has already validated this is a ProductCategory at parse time
              category: intent.category as
                | "dairy"
                | "produce"
                | "pantry"
                | "household"
                | "beverages"
                | "frozen"
                | "bakery"
                | "meat"
                | "other",
              confidence: intent.confidence,
              needsClarification: intent.needsClarification,
              clarificationReason: intent.clarificationReason,
            })
            .run();
          intentIds.push(id);
        }

        const output = OutputSchema.parse({ intentIds });

        await emitWorkflowEvent({
          runId: input.runId,
          step: "normalizeItems",
          status: "succeeded",
          attempt,
          correlationId: input.correlationId,
          payload: { count: intentIds.length },
        });
        return output;
      },
    );
  },
});
