import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { ensureMigrated, getDb } from "@/lib/db/client";
import { runs } from "@/lib/db/schema";
import { newCorrelationId } from "@/lib/observability/correlation";
import { logger } from "@/lib/observability/logger";
import { internalError } from "@/lib/server/api";
import { ingestImage } from "@/lib/server/upload";
import { triggerSnapbasketRun } from "@/lib/server/workflow-trigger";

export const dynamic = "force-dynamic";

const DEMO_IMAGE_PATH = path.resolve(process.cwd(), "public/demo/grocery-note-sample.webp");

export async function POST() {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(readFileSync(DEMO_IMAGE_PATH));
  } catch (err) {
    logger.error("demo image missing", {
      path: DEMO_IMAGE_PATH,
      error: err instanceof Error ? err.message : String(err),
    });
    return internalError("Demo image not found on disk");
  }

  await ensureMigrated();
  const upload = await ingestImage({ bytes, mime: "image/png" });

  const db = getDb();
  const runId = `run_${randomUUID()}`;
  const correlationId = newCorrelationId();
  const userId = "user_default";

  await db
    .insert(runs)
    .values({
      id: runId,
      imageId: upload.imageId,
      userId,
      correlationId,
      status: "PENDING",
    })
    .run();

  try {
    const { triggerRunId } = await triggerSnapbasketRun({
      runId,
      correlationId,
      imageId: upload.imageId,
      sha256: upload.sha256,
      imageBytes: bytes,
      mime: "image/png",
    });

    await db.update(runs).set({ triggerRunId }).where(eq(runs.id, runId)).run();

    logger.info("demo run started", {
      runId,
      correlationId,
      triggerRunId,
      isDuplicate: upload.isDuplicate,
    });
    return NextResponse.json({
      runId,
      correlationId,
      triggerRunId,
      imageId: upload.imageId,
      isDuplicate: upload.isDuplicate,
    });
  } catch (err) {
    logger.error("demo trigger failed", {
      runId,
      correlationId,
      error: err instanceof Error ? err.message : String(err),
    });
    await db.update(runs).set({ status: "FAILED" }).where(eq(runs.id, runId)).run();
    return internalError("Failed to trigger demo run");
  }
}
