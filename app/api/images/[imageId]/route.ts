import { readFile } from "node:fs/promises";

import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { ensureMigrated, getDb } from "@/lib/db/client";
import { images } from "@/lib/db/schema";
import { logger } from "@/lib/observability/logger";
import { internalError, notFound } from "@/lib/server/api";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ imageId: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { imageId } = await params;

  await ensureMigrated();
  const db = getDb();
  const row = (await db.select().from(images).where(eq(images.id, imageId)).all())[0];
  if (!row) return notFound(`Image ${imageId} not found`);

  let bytes: Buffer;
  try {
    bytes = await readFile(row.storagePath);
  } catch (err) {
    logger.error("image file read failed", {
      imageId,
      storagePath: row.storagePath,
      error: err instanceof Error ? err.message : String(err),
    });
    return internalError("Image file missing on disk");
  }

  // sha256-keyed storage path means content never changes for a given imageId.
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": row.mime,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
