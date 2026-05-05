import { task } from "@trigger.dev/sdk";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { buildBasket } from "./buildBasket";
import { enrichItems } from "./enrichItems";
import { extractRawTextFromImage } from "./extractRawTextFromImage";
import { finalizeMockCheckout } from "./finalizeMockCheckout";
import { ingestImage } from "./ingestImage";
import { matchProducts } from "./matchProducts";
import { normalizeItems } from "./normalizeItems";
import { parseGroceryIntent } from "./parseGroceryIntent";
import { requireHumanApproval } from "./requireHumanApproval";
import { validateBasketPolicy } from "./validateBasketPolicy";

import { getDb } from "@/lib/db/client";
import { runs } from "@/lib/db/schema";
import { logger } from "@/lib/observability/logger";
import { withSpan } from "@/lib/observability/otel";
import { commerceProvider } from "@/lib/providers/commerce";

const WorkflowInputSchema = z.object({
  runId: z.string(),
  correlationId: z.string(),
  imageId: z.string(),
  sha256: z.string(),
  imageBytes: z.instanceof(Uint8Array),
  mime: z.string(),
});

export const snapbasketWorkflow = task({
  id: "snapbasket.run",
  retry: { maxAttempts: 1 },
  run: async (raw: unknown) => {
    const input = WorkflowInputSchema.parse(raw);
    return withSpan(
      "snapbasket.run",
      {
        correlationId: input.correlationId,
        runId: input.runId,
        step: "root",
      },
      async () => {
        const db = getDb();
        db.update(runs).set({ status: "RUNNING" }).where(eq(runs.id, input.runId)).run();

        try {
          // Step 1: ingestImage (idempotent on sha256)
          await ingestImage
            .triggerAndWait(
              {
                runId: input.runId,
                correlationId: input.correlationId,
                imageId: input.imageId,
                sha256: input.sha256,
              },
              { idempotencyKey: input.sha256 },
            )
            .unwrap();

          // Step 2: extractRawTextFromImage (idempotent on imageId)
          const extractResult = await extractRawTextFromImage
            .triggerAndWait(
              {
                runId: input.runId,
                correlationId: input.correlationId,
                imageId: input.imageId,
                imageBytes: input.imageBytes,
                mime: input.mime,
              },
              { idempotencyKey: input.imageId },
            )
            .unwrap();

          // Step 3: parseGroceryIntent (idempotent on imageId+rawTextHash)
          const parseResult = await parseGroceryIntent
            .triggerAndWait(
              {
                runId: input.runId,
                correlationId: input.correlationId,
                imageId: input.imageId,
                rawText: extractResult.rawText,
              },
              { idempotencyKey: `${input.imageId}:${extractResult.rawTextHash}` },
            )
            .unwrap();

          // Step 4: normalizeItems (one normalization per run)
          const normalizeResult = await normalizeItems
            .triggerAndWait(
              {
                runId: input.runId,
                correlationId: input.correlationId,
                intents: parseResult.intents,
              },
              { idempotencyKey: input.runId },
            )
            .unwrap();

          // Step 5: enrichItems per intent
          for (const intentId of normalizeResult.intentIds) {
            await enrichItems
              .triggerAndWait(
                { runId: input.runId, correlationId: input.correlationId, intentId },
                { idempotencyKey: intentId },
              )
              .unwrap();
          }

          // Step 6: matchProducts in parallel (queue concurrency limit handles fan-out)
          const matchBatch = await matchProducts.batchTriggerAndWait(
            normalizeResult.intentIds.map((intentId) => ({
              payload: { runId: input.runId, correlationId: input.correlationId, intentId },
              options: { idempotencyKey: `${intentId}:${commerceProvider.name}` },
            })),
          );
          for (const run of matchBatch.runs) {
            if (!run.ok) {
              const err = run.error instanceof Error ? run.error : new Error(String(run.error));
              const msg = err.message ?? "unknown";
              logger.error("matchProducts task failed", {
                runId: input.runId,
                correlationId: input.correlationId,
                error: msg,
              });
              throw new Error(`matchProducts failed: ${msg}`);
            }
          }

          // Step 7: buildBasket (deterministic idempotency on runId)
          const basketResult = await buildBasket
            .triggerAndWait(
              { runId: input.runId, correlationId: input.correlationId },
              { idempotencyKey: input.runId },
            )
            .unwrap();

          // Step 8: validateBasketPolicy (idempotent on basketId)
          await validateBasketPolicy
            .triggerAndWait(
              {
                runId: input.runId,
                correlationId: input.correlationId,
                basketId: basketResult.basketId,
              },
              { idempotencyKey: basketResult.basketId },
            )
            .unwrap();

          // Step 9: durable pause for human approval (24h timeout)
          const approval = await requireHumanApproval
            .triggerAndWait({
              runId: input.runId,
              correlationId: input.correlationId,
              basketId: basketResult.basketId,
            })
            .unwrap();

          if (approval.status === "TIMED_OUT") {
            logger.info("workflow ended on timeout", {
              runId: input.runId,
              correlationId: input.correlationId,
            });
            return { status: "TIMED_OUT" as const, runId: input.runId };
          }
          if (approval.status === "REJECTED") {
            logger.info("workflow ended on rejection", {
              runId: input.runId,
              correlationId: input.correlationId,
            });
            return {
              status: "REJECTED" as const,
              runId: input.runId,
              reason: approval.decision?.reason ?? null,
            };
          }

          // Step 10: finalize (only after APPROVED)
          if (!approval.decision) {
            throw new Error("snapbasket.run: APPROVED but no decision payload");
          }

          // The approvalTokenId was persisted on the runs row by requireHumanApproval.
          const runRow = db.select().from(runs).where(eq(runs.id, input.runId)).all()[0];
          if (!runRow?.approvalTokenId) {
            throw new Error("snapbasket.run: missing approvalTokenId on runs row");
          }

          const finalize = await finalizeMockCheckout
            .triggerAndWait(
              {
                runId: input.runId,
                correlationId: input.correlationId,
                basketId: basketResult.basketId,
                approvalTokenId: runRow.approvalTokenId,
              },
              { idempotencyKey: `${basketResult.basketId}:${runRow.approvalTokenId}` },
            )
            .unwrap();

          return {
            status: "COMPLETED" as const,
            runId: input.runId,
            sessionId: finalize.sessionId,
          };
        } catch (err) {
          db.update(runs).set({ status: "FAILED" }).where(eq(runs.id, input.runId)).run();
          logger.error("workflow failed", {
            runId: input.runId,
            correlationId: input.correlationId,
            error: err instanceof Error ? err.message : String(err),
          });
          throw err;
        }
      },
    );
  },
});
