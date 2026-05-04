import { randomUUID } from "node:crypto";

import { wait } from "@trigger.dev/sdk";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/lib/db/client";
import { runs, userConsents } from "@/lib/db/schema";
import { logger } from "@/lib/observability/logger";
import { badRequest, conflict, internalError, notFound, parseJsonBody } from "@/lib/server/api";

export const dynamic = "force-dynamic";

const ApproveSchema = z.object({
  approved: z.boolean(),
  decidedBy: z.string().min(1),
  reason: z.string().nullable(),
});

interface RouteContext {
  params: Promise<{ runId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { runId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Expected JSON body");
  }

  const parsed = parseJsonBody(ApproveSchema, body);
  if (!parsed.ok) return parsed.res;

  const db = getDb();
  const run = db.select().from(runs).where(eq(runs.id, runId)).all()[0];
  if (!run) return notFound(`Run ${runId} not found`);
  if (run.status !== "AWAITING_APPROVAL") {
    return conflict(`Run ${runId} is not awaiting approval (current status: ${run.status})`);
  }
  if (!run.approvalTokenId) {
    return internalError(`Run ${runId} has no approvalTokenId despite AWAITING_APPROVAL status`);
  }

  const decision = {
    approved: parsed.data.approved,
    decidedBy: parsed.data.decidedBy,
    reason: parsed.data.reason,
    decidedAt: new Date().toISOString(),
  };

  // Persist the consent BEFORE completing the token, so the audit trail exists
  // even if the SDK call fails after partial work.
  db.insert(userConsents)
    .values({
      id: `con_${randomUUID()}`,
      runId,
      decidedBy: parsed.data.decidedBy,
      approved: parsed.data.approved,
      reason: parsed.data.reason,
    })
    .run();

  try {
    // Complete the waitpoint, this resumes the requireHumanApproval task,
    // which resumes the root workflow
    await wait.completeToken(run.approvalTokenId, decision);
    logger.info("approval recorded; waitpoint completed", {
      runId,
      tokenId: run.approvalTokenId,
      approved: parsed.data.approved,
    });
    return NextResponse.json({ ok: true, decision });
  } catch (err) {
    logger.error("wait.completeToken failed", {
      runId,
      tokenId: run.approvalTokenId,
      error: err instanceof Error ? err.message : String(err),
    });
    return internalError("Failed to complete waitpoint token");
  }
}
