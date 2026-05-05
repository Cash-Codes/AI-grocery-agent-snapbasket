import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { eq } from "drizzle-orm";

import { ensureMigrated, getDb } from "@/lib/db/client";
import { images } from "@/lib/db/schema";

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

const UPLOAD_DIR = path.resolve(process.cwd(), "data/uploads");

export interface UploadResult {
  imageId: string;
  sha256: string;
  mime: string;
  sizeBytes: number;
  storagePath: string;
  isDuplicate: boolean;
}

export class UploadError extends Error {
  constructor(
    public readonly code: "MIME" | "SIZE" | "EMPTY",
    message: string,
  ) {
    super(message);
  }
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function extensionFor(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return "bin";
}

export async function ingestImage(input: {
  bytes: Uint8Array;
  mime: string;
}): Promise<UploadResult> {
  if (input.bytes.byteLength === 0) {
    throw new UploadError("EMPTY", "Empty file");
  }
  if (!ALLOWED_MIME.has(input.mime)) {
    throw new UploadError("MIME", `Unsupported MIME type: ${input.mime}`);
  }
  if (input.bytes.byteLength > MAX_BYTES) {
    throw new UploadError("SIZE", `File exceeds ${MAX_BYTES} bytes`);
  }

  const sha256 = sha256Hex(input.bytes);
  await ensureMigrated();
  const db = getDb();

  // Dedup: same content hash - same imageId.
  const existing = (await db.select().from(images).where(eq(images.sha256, sha256)).all())[0];
  if (existing) {
    return {
      imageId: existing.id,
      sha256: existing.sha256,
      mime: existing.mime,
      sizeBytes: existing.sizeBytes,
      storagePath: existing.storagePath,
      isDuplicate: true,
    };
  }

  // New upload - write to disk and insert.
  mkdirSync(UPLOAD_DIR, { recursive: true });
  const ext = extensionFor(input.mime);
  const storagePath = path.join(UPLOAD_DIR, `${sha256}.${ext}`);
  writeFileSync(storagePath, input.bytes);

  const imageId = `img_${randomUUID()}`;
  await db
    .insert(images)
    .values({
      id: imageId,
      sha256,
      mime: input.mime,
      sizeBytes: input.bytes.byteLength,
      storagePath,
    })
    .run();

  return {
    imageId,
    sha256,
    mime: input.mime,
    sizeBytes: input.bytes.byteLength,
    storagePath,
    isDuplicate: false,
  };
}
