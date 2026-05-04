import { task } from "@trigger.dev/sdk";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db/client";
import { checkoutSessions, runs } from "@/lib/db/schema";
import { emitWorkflowEvent } from "@/lib/observability/events";
import { withSpan } from "@/lib/observability/otel";
import { commerceProvider } from "@/lib/providers/commerce";
import { STANDARD_RETRY } from "@/lib/trigger/retry";

const InputSchema = z.object({
  runId: z.string(),
  correlationId: z.string(),
  basketId: z.string(),
  approvalTokenId: z.string(),
});

const OutputSchema = z.object({
  sessionId: z.string(),
  status: z.enum(["PENDING", "COMPLETED", "FAILED"]),
});

export const finalizeMockCheckout = task({
  id: "snapbasket.finalizeMockCheckout",
  retry: STANDARD_RETRY,
  run: async (raw: unknown, { ctx }) => {
    const input = InputSchema.parse(raw);
    const attempt = ctx.attempt.number;
    return withSpan(
      "finalizeMockCheckout",
      {
        correlationId: input.correlationId,
        runId: input.runId,
        step: "finalizeMockCheckout",
        attempt,
      },
      async () => {
        emitWorkflowEvent({
          runId: input.runId,
          step: "finalizeMockCheckout",
          status: attempt > 1 ? "retrying" : "started",
          attempt,
          correlationId: input.correlationId,
        });

        const session = await commerceProvider.createCheckoutSession({
          basketId: input.basketId,
          consent: {
            termsAccepted: true,
            privacyAccepted: true,
            marketingOptIn: false,
            acceptedAt: new Date().toISOString(),
          },
          // Idempotency key incorporates approval token, so a duplicate finalize
          // (e.g., retry after partial failure) returns the same session.
          idempotencyKey: `${input.basketId}:${input.approvalTokenId}`,
        });

        // Mark the session COMPLETED in our DB (mock has no real fulfillment lifecycle).
        const db = getDb();
        db.update(checkoutSessions)
          .set({ status: "COMPLETED", finalizedAt: new Date() })
          .where(eq(checkoutSessions.id, session.id))
          .run();

        // Mark the run COMPLETED.
        db.update(runs).set({ status: "COMPLETED" }).where(eq(runs.id, input.runId)).run();

        const output = OutputSchema.parse({ sessionId: session.id, status: "COMPLETED" });

        emitWorkflowEvent({
          runId: input.runId,
          step: "finalizeMockCheckout",
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
