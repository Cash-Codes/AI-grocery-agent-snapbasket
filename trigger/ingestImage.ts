import { task } from "@trigger.dev/sdk";
import { z } from "zod";

import { emitWorkflowEvent } from "@/lib/observability/events";
import { logger } from "@/lib/observability/logger";
import { withSpan } from "@/lib/observability/otel";
import { NO_RETRY } from "@/lib/trigger/retry";

const InputSchema = z.object({
  runId: z.string(),
  correlationId: z.string(),
  imageId: z.string(),
  sha256: z.string(),
});

const OutputSchema = z.object({
  imageId: z.string(),
  sha256: z.string(),
});

export const ingestImage = task({
  id: "snapbasket.ingestImage",
  retry: NO_RETRY,
  run: async (raw: unknown, { ctx }) => {
    const input = InputSchema.parse(raw);
    const attempt = ctx.attempt.number;
    return withSpan(
      "ingestImage",
      {
        correlationId: input.correlationId,
        runId: input.runId,
        step: "ingestImage",
        attempt,
      },
      async () => {
        await emitWorkflowEvent({
          runId: input.runId,
          step: "ingestImage",
          status: "started",
          attempt,
          correlationId: input.correlationId,
        });
        logger.info("ingestImage start", {
          correlationId: input.correlationId,
          runId: input.runId,
          imageId: input.imageId,
        });

        const output = OutputSchema.parse({ imageId: input.imageId, sha256: input.sha256 });

        await emitWorkflowEvent({
          runId: input.runId,
          step: "ingestImage",
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
