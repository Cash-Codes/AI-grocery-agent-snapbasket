import { type NextRequest, NextResponse } from "next/server";

import { logger } from "@/lib/observability/logger";
import { badRequest, internalError } from "@/lib/server/api";
import { UploadError, ingestImage } from "@/lib/server/upload";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return badRequest("Expected multipart/form-data body");
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return badRequest("Missing file field (form key 'file')");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    const result = await ingestImage({ bytes, mime: file.type });
    logger.info("upload accepted", {
      imageId: result.imageId,
      sha256: result.sha256,
      sizeBytes: result.sizeBytes,
      isDuplicate: result.isDuplicate,
    });
    return NextResponse.json(result, { status: result.isDuplicate ? 200 : 201 });
  } catch (err) {
    if (err instanceof UploadError) {
      return badRequest(err.message, { code: err.code });
    }
    logger.error("upload failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return internalError("Upload failed");
  }
}
