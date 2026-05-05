import { task } from "@trigger.dev/sdk";
import { z } from "zod";

import { emitWorkflowEvent } from "@/lib/observability/events";
import { withSpan } from "@/lib/observability/otel";
import { parseGroceryText } from "@/lib/parser/intent";
import { SHORT_RETRY } from "@/lib/trigger/retry";

const InputSchema = z.object({
  runId: z.string(),
  correlationId: z.string(),
  imageId: z.string(),
  rawText: z.string(),
});

const ParsedIntentSchema = z.object({
  originalText: z.string(),
  canonicalName: z.string(),
  quantity: z.number(),
  unit: z.string(),
  category: z.string(),
  confidence: z.number(),
  needsClarification: z.boolean(),
  clarificationReason: z.string().nullable(),
});

const OutputSchema = z.object({
  intents: z.array(ParsedIntentSchema),
});

export const parseGroceryIntent = task({
  id: "snapbasket.parseGroceryIntent",
  retry: SHORT_RETRY,
  run: async (raw: unknown, { ctx }) => {
    const input = InputSchema.parse(raw);
    const attempt = ctx.attempt.number;
    return withSpan(
      "parseGroceryIntent",
      {
        correlationId: input.correlationId,
        runId: input.runId,
        step: "parseGroceryIntent",
        attempt,
      },
      async () => {
        await emitWorkflowEvent({
          runId: input.runId,
          step: "parseGroceryIntent",
          status: "started",
          attempt,
          correlationId: input.correlationId,
        });

        const intents = parseGroceryText(input.rawText);
        const output = OutputSchema.parse({ intents });

        await emitWorkflowEvent({
          runId: input.runId,
          step: "parseGroceryIntent",
          status: "succeeded",
          attempt,
          correlationId: input.correlationId,
          payload: { intentCount: intents.length },
        });
        return output;
      },
    );
  },
});
