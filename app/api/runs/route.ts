import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ensureMigrated, getDb } from "@/lib/db/client";
import { images, runs } from "@/lib/db/schema";
import { newCorrelationId } from "@/lib/observability/correlation";
import { logger } from "@/lib/observability/logger";
import { badRequest, internalError, notFound, parseJsonBody } from "@/lib/server/api";
import { triggerSnapbasketRun } from "@/lib/server/workflow-trigger";

export const dynamic = "force-dynamic";

const StartRunSchema = z.object({
  imageId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Expected JSON body");
  }

  const parsed = parseJsonBody(StartRunSchema, body);
  if (!parsed.ok) return parsed.res;

  await ensureMigrated();
  const db = getDb();
  const image = (await db.select().from(images).where(eq(images.id, parsed.data.imageId)).all())[0];
  if (!image) return notFound(`Image ${parsed.data.imageId} not found`);

  const runId = `run_${randomUUID()}`;
  const correlationId = newCorrelationId();
  const userId = "user_default";

  await db
    .insert(runs)
    .values({
      id: runId,
      imageId: parsed.data.imageId,
      userId,
      correlationId,
      status: "PENDING",
    })
    .run();

  // Read the file bytes for the workflow payload.
  let imageBytes: Uint8Array;
  try {
    imageBytes = new Uint8Array(readFileSync(image.storagePath));
  } catch (err) {
    logger.error("failed to read image bytes", {
      runId,
      correlationId,
      storagePath: image.storagePath,
      error: err instanceof Error ? err.message : String(err),
    });
    return internalError("Image file missing on disk");
  }

  try {
    const { triggerRunId } = await triggerSnapbasketRun({
      runId,
      correlationId,
      imageId: image.id,
      sha256: image.sha256,
      imageBytes,
      mime: image.mime,
    });

    await db.update(runs).set({ triggerRunId }).where(eq(runs.id, runId)).run();

    logger.info("run started", { runId, correlationId, triggerRunId });
    return NextResponse.json({ runId, correlationId, triggerRunId }, { status: 201 });
  } catch (err) {
    logger.error("failed to trigger run", {
      runId,
      correlationId,
      error: err instanceof Error ? err.message : String(err),
    });
    await db.update(runs).set({ status: "FAILED" }).where(eq(runs.id, runId)).run();
    return internalError("Failed to trigger workflow");
  }
}
