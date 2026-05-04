import { task } from "@trigger.dev/sdk";
import { z } from "zod";

import { emitWorkflowEvent } from "@/lib/observability/events";
import { logger } from "@/lib/observability/logger";
import { withSpan } from "@/lib/observability/otel";
import { visionProvider } from "@/lib/providers/vision";
import { maybeInjectFault } from "@/lib/trigger/fault-injection";
import { STANDARD_RETRY } from "@/lib/trigger/retry";

const InputSchema = z.object({
  runId: z.string(),
  correlationId: z.string(),
  imageId: z.string(),
  imageBytes: z.instanceof(Uint8Array),
  mime: z.string(),
});

const OutputSchema = z.object({
  imageId: z.string(),
  rawText: z.string().min(1),
  confidence: z.number().min(0).max(1),
  rawTextHash: z.string(),
});

export const extractRawTextFromImage = task({
  id: "snapbasket.extractRawTextFromImage",
  retry: STANDARD_RETRY,
  run: async (raw: unknown, { ctx }) => {
    const input = InputSchema.parse(raw);
    const attempt = ctx.attempt.number;
    return withSpan(
      "extractRawTextFromImage",
      {
        correlationId: input.correlationId,
        runId: input.runId,
        step: "extractRawTextFromImage",
        attempt,
      },
      async () => {
        emitWorkflowEvent({
          runId: input.runId,
          step: "extractRawTextFromImage",
          status: attempt > 1 ? "retrying" : "started",
          attempt,
          correlationId: input.correlationId,
        });

        maybeInjectFault("extractRawTextFromImage", attempt);

        logger.info("extractRawTextFromImage call", {
          correlationId: input.correlationId,
          runId: input.runId,
          provider: visionProvider.name,
        });

        const result = await visionProvider.extractText({
          imageBytes: input.imageBytes,
          mime: input.mime,
        });

        const rawTextHash = await sha256Hex(result.rawText);

        const output = OutputSchema.parse({
          imageId: input.imageId,
          rawText: result.rawText,
          confidence: result.confidence,
          rawTextHash,
        });

        emitWorkflowEvent({
          runId: input.runId,
          step: "extractRawTextFromImage",
          status: "succeeded",
          attempt,
          correlationId: input.correlationId,
          payload: { rawTextLength: result.rawText.length, confidence: result.confidence },
        });
        return output;
      },
    );
  },
});

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
