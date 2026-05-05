import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { ensureMigrated, getDb } from "@/lib/db/client";
import {
  basketItems,
  baskets,
  checkoutSessions,
  policyResults,
  productCandidates,
  productIntents,
  runs,
  workflowEvents,
} from "@/lib/db/schema";
import { notFound } from "@/lib/server/api";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ runId: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { runId } = await params;
  await ensureMigrated();
  const db = getDb();

  const run = (await db.select().from(runs).where(eq(runs.id, runId)).all())[0];
  if (!run) return notFound(`Run ${runId} not found`);

  const intents = await db
    .select()
    .from(productIntents)
    .where(eq(productIntents.runId, runId))
    .all();
  const candidatesByIntent: Record<string, unknown[]> = {};
  for (const intent of intents) {
    candidatesByIntent[intent.id] = await db
      .select()
      .from(productCandidates)
      .where(eq(productCandidates.intentId, intent.id))
      .all();
  }

  const basket = (await db.select().from(baskets).where(eq(baskets.runId, runId)).all())[0] ?? null;
  const items = basket
    ? await db.select().from(basketItems).where(eq(basketItems.basketId, basket.id)).all()
    : [];
  const policy = basket
    ? ((
        await db.select().from(policyResults).where(eq(policyResults.basketId, basket.id)).all()
      )[0] ?? null)
    : null;

  const checkoutSession = basket
    ? ((
        await db
          .select()
          .from(checkoutSessions)
          .where(eq(checkoutSessions.basketId, basket.id))
          .all()
      )[0] ?? null)
    : null;

  const events = await db
    .select()
    .from(workflowEvents)
    .where(eq(workflowEvents.runId, runId))
    .all();

  return NextResponse.json({
    run,
    intents,
    candidatesByIntent,
    basket,
    items,
    policy,
    checkoutSession,
    events,
  });
}
