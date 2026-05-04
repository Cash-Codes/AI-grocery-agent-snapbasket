import { task } from "@trigger.dev/sdk";
import { z } from "zod";

import { emitWorkflowEvent } from "@/lib/observability/events";
import { withSpan } from "@/lib/observability/otel";
import { maybeInjectFault } from "@/lib/trigger/fault-injection";
import { STANDARD_RETRY } from "@/lib/trigger/retry";

const InputSchema = z.object({
  runId: z.string(),
  correlationId: z.string(),
  intentId: z.string(),
});

const OutputSchema = z.object({
  intentId: z.string(),
  enriched: z.boolean(),
});

export const enrichItems = task({
  id: "snapbasket.enrichItems",
  retry: STANDARD_RETRY,
  run: async (raw: unknown, { ctx }) => {
    const input = InputSchema.parse(raw);
    const attempt = ctx.attempt.number;
    return withSpan(
      "enrichItems",
      {
        correlationId: input.correlationId,
        runId: input.runId,
        step: "enrichItems",
        attempt,
      },
      async () => {
        emitWorkflowEvent({
          runId: input.runId,
          step: "enrichItems",
          status: attempt > 1 ? "retrying" : "started",
          attempt,
          correlationId: input.correlationId,
        });

        maybeInjectFault("enrichItems", attempt);

        //no op for now, stubbing shape for future enrichment for llm ambiguity res, user pref etc
        const output = OutputSchema.parse({ intentId: input.intentId, enriched: true });

        emitWorkflowEvent({
          runId: input.runId,
          step: "enrichItems",
          status: "succeeded",
          attempt,
          correlationId: input.correlationId,
        });
        return output;
      },
    );
  },
});
