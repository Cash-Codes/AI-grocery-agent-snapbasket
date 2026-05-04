import { task, wait } from "@trigger.dev/sdk";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db/client";
import { runs } from "@/lib/db/schema";
import { emitWorkflowEvent } from "@/lib/observability/events";
import { logger } from "@/lib/observability/logger";
import { withSpan } from "@/lib/observability/otel";

const InputSchema = z.object({
  runId: z.string(),
  correlationId: z.string(),
  basketId: z.string(),
});

const ApprovalDecisionSchema = z.object({
  approved: z.boolean(),
  decidedBy: z.string(),
  reason: z.string().nullable(),
  decidedAt: z.string().datetime(),
});

export type ApprovalDecisionWaitpoint = z.infer<typeof ApprovalDecisionSchema>;

const OutputSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "TIMED_OUT"]),
  decision: ApprovalDecisionSchema.nullable(),
});

export const requireHumanApproval = task({
  id: "snapbasket.requireHumanApproval",
  retry: { maxAttempts: 1 },
  run: async (raw: unknown, { ctx }) => {
    const input = InputSchema.parse(raw);
    const attempt = ctx.attempt.number;
    return withSpan(
      "requireHumanApproval",
      {
        correlationId: input.correlationId,
        runId: input.runId,
        step: "requireHumanApproval",
        attempt,
        basketId: input.basketId,
      },
      async () => {
        emitWorkflowEvent({
          runId: input.runId,
          step: "requireHumanApproval",
          status: "started",
          attempt,
          correlationId: input.correlationId,
        });

        const tokenHandle = await wait.createToken({
          timeout: "24h",
          tags: [`run:${input.runId}`],
        });

        // Persist the token id on the run row so the API route can look it up by runId.
        const db = getDb();
        db.update(runs)
          .set({
            approvalTokenId: tokenHandle.id,
            status: "AWAITING_APPROVAL",
          })
          .where(eq(runs.id, input.runId))
          .run();

        logger.info("requireHumanApproval pause", {
          correlationId: input.correlationId,
          runId: input.runId,
          tokenId: tokenHandle.id,
        });

        // Durable pause — workflow run is checkpointed; resumes when token completes
        // or the timeout fires. The 24h timeout is set on the token at creation time.
        const result = await wait.forToken<ApprovalDecisionWaitpoint>(tokenHandle.id);

        if (!result.ok) {
          // Timeout
          db.update(runs).set({ status: "TIMED_OUT" }).where(eq(runs.id, input.runId)).run();
          emitWorkflowEvent({
            runId: input.runId,
            step: "requireHumanApproval",
            status: "succeeded",
            attempt,
            correlationId: input.correlationId,
            payload: { outcome: "TIMED_OUT" },
          });
          return OutputSchema.parse({ status: "TIMED_OUT", decision: null });
        }

        const decision = ApprovalDecisionSchema.parse(result.output);
        const newStatus = decision.approved ? "APPROVED" : "REJECTED";
        db.update(runs).set({ status: newStatus }).where(eq(runs.id, input.runId)).run();

        emitWorkflowEvent({
          runId: input.runId,
          step: "requireHumanApproval",
          status: "succeeded",
          attempt,
          correlationId: input.correlationId,
          payload: { outcome: newStatus, decidedBy: decision.decidedBy },
        });

        return OutputSchema.parse({ status: newStatus, decision });
      },
    );
  },
});
