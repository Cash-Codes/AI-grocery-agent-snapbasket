import { describe, expect, it } from "vitest";

import { isCorrelationId, newCorrelationId } from "@/lib/observability/correlation";
import { logger } from "@/lib/observability/logger";

describe("correlation", () => {
  it("newCorrelationId produces a valid corr_ id", () => {
    const id = newCorrelationId();
    expect(id.startsWith("corr_")).toBe(true);
    expect(isCorrelationId(id)).toBe(true);
  });

  it("isCorrelationId rejects malformed input", () => {
    expect(isCorrelationId("notacorr")).toBe(false);
    expect(isCorrelationId("corr_short")).toBe(false);
    expect(isCorrelationId("")).toBe(false);
  });
});

describe("logger", () => {
  it("exposes debug/info/warn/error methods", () => {
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
  });
});
