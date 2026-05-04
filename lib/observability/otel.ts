import "server-only";

import { type Span, SpanStatusCode, trace } from "@opentelemetry/api";

const TRACER_NAME = "snapbasket";

export function getTracer() {
  return trace.getTracer(TRACER_NAME);
}

export interface SpanAttributes {
  correlationId: string;
  runId: string;
  step: string;
  attempt?: number;
  [key: string]: string | number | boolean | undefined;
}

export async function withSpan<T>(
  name: string,
  attributes: SpanAttributes,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  const tracer = getTracer();
  return tracer.startActiveSpan(name, async (span) => {
    for (const [key, value] of Object.entries(attributes)) {
      if (value !== undefined) span.setAttribute(`snapbasket.${key}`, value);
    }
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err instanceof Error ? err.message : String(err),
      });
      span.recordException(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      span.end();
    }
  });
}
