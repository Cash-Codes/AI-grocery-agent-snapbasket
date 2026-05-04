import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export function errorResponse(status: number, error: ApiError): NextResponse {
  return NextResponse.json({ error }, { status });
}

export function badRequest(message: string, details?: unknown): NextResponse {
  return errorResponse(400, { code: "BAD_REQUEST", message, ...(details ? { details } : {}) });
}

export function notFound(message: string): NextResponse {
  return errorResponse(404, { code: "NOT_FOUND", message });
}

export function conflict(message: string): NextResponse {
  return errorResponse(409, { code: "CONFLICT", message });
}

export function internalError(message: string, details?: unknown): NextResponse {
  return errorResponse(500, { code: "INTERNAL", message, ...(details ? { details } : {}) });
}

export function parseJsonBody<T>(
  schema: z.ZodType<T>,
  body: unknown,
): { ok: true; data: T } | { ok: false; res: NextResponse } {
  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      ok: false,
      res: badRequest("Invalid request body", result.error.issues),
    };
  }
  return { ok: true, data: result.data };
}
