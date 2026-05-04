/**
 * this test PROVES:
 *   - The fault injection helper fires on attempt 1 when rate=1.0.
 *   - The fault injection helper does NOT fire on attempt 2 (or higher).
 *   - The thrown error matches the documented format (so log assertions work).
 *   - Rate boundary conditions (0, 1, undefined, non-numeric) are handled correctly.
 *
 * this test CANNOT prove (trigger.dev sdk guarantee):
 *   - That Trigger.dev's runtime actually re-invokes `task.run(...)` on failure
 *     with `ctx.attempt.number = 2`. That's a property of the sdk
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { maybeInjectFault } from "@/lib/trigger/fault-injection";

describe("retry-then-success proof — MOCK_FAULT_RATE boundary conditions", () => {
  const ORIGINAL_RATE = process.env.MOCK_FAULT_RATE;

  afterEach(() => {
    if (ORIGINAL_RATE === undefined) {
      delete process.env.MOCK_FAULT_RATE;
    } else {
      process.env.MOCK_FAULT_RATE = ORIGINAL_RATE;
    }
  });

  describe("rate = 1.0 (always fault)", () => {
    beforeEach(() => {
      process.env.MOCK_FAULT_RATE = "1.0";
    });

    it("attempt 1 throws MOCK_FAULT", () => {
      expect(() => maybeInjectFault("extractRawTextFromImage", 1)).toThrow(/MOCK_FAULT/);
    });

    it("attempt 1 throws with the documented message format", () => {
      try {
        maybeInjectFault("matchProducts", 1);
        throw new Error("expected to throw");
      } catch (err) {
        if (err instanceof Error) {
          expect(err.message).toMatch(/MOCK_FAULT injected in matchProducts \(rate=1, attempt=1\)/);
        } else {
          throw err;
        }
      }
    });

    it("attempt 2 does NOT throw (retry would succeed)", () => {
      expect(() => maybeInjectFault("extractRawTextFromImage", 2)).not.toThrow();
    });

    it("attempt 3 does NOT throw (retries beyond 2 also succeed)", () => {
      expect(() => maybeInjectFault("extractRawTextFromImage", 3)).not.toThrow();
    });
  });

  describe("rate = 0 (never fault — default)", () => {
    beforeEach(() => {
      process.env.MOCK_FAULT_RATE = "0";
    });

    it("attempt 1 does NOT throw", () => {
      expect(() => maybeInjectFault("extractRawTextFromImage", 1)).not.toThrow();
    });
  });

  describe("rate is missing or non-numeric", () => {
    it("undefined MOCK_FAULT_RATE is treated as 0 (no fault)", () => {
      delete process.env.MOCK_FAULT_RATE;
      expect(() => maybeInjectFault("extractRawTextFromImage", 1)).not.toThrow();
    });

    it("non-numeric MOCK_FAULT_RATE is treated as 0 (no fault)", () => {
      process.env.MOCK_FAULT_RATE = "not-a-number";
      expect(() => maybeInjectFault("extractRawTextFromImage", 1)).not.toThrow();
    });
  });
});
