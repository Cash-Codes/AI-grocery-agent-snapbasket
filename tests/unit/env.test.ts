import { describe, expect, it } from "vitest";
import { z } from "zod";

// We re-derive the schema in the test rather than importing it directly,
// because the module's top-level `parseEnv()` call would fail on missing
// env vars in a unit-test context. This tests the schema's shape + rules
// without coupling to the singleton.

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  TRIGGER_PROJECT_REF: z.string().min(1).optional(),
  TRIGGER_API_KEY: z.string().min(1).optional(),
  TRIGGER_SECRET_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().regex(/^sk-/, "OPENAI_API_KEY must start with 'sk-'").optional(),
  OPENAI_MODEL: z.string().default("gpt-4o"),
  MOCK_FAULT_RATE: z.coerce.number().min(0).max(1).default(0),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

describe("env schema", () => {
  it("accepts a fully empty config (all optional fields)", () => {
    const result = EnvSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.OPENAI_MODEL).toBe("gpt-4o");
      expect(result.data.MOCK_FAULT_RATE).toBe(0);
      expect(result.data.NODE_ENV).toBe("development");
    }
  });

  it("rejects an OPENAI_API_KEY that doesn't start with 'sk-'", () => {
    const result = EnvSchema.safeParse({ OPENAI_API_KEY: "garbage_no_prefix" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/sk-/);
    }
  });

  it("accepts a valid OPENAI_API_KEY", () => {
    const result = EnvSchema.safeParse({ OPENAI_API_KEY: "sk-test-1234567890" });
    expect(result.success).toBe(true);
  });

  it("coerces MOCK_FAULT_RATE from string", () => {
    const result = EnvSchema.safeParse({ MOCK_FAULT_RATE: "0.3" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.MOCK_FAULT_RATE).toBe(0.3);
    }
  });

  it("rejects MOCK_FAULT_RATE outside [0, 1]", () => {
    const tooHigh = EnvSchema.safeParse({ MOCK_FAULT_RATE: "1.5" });
    expect(tooHigh.success).toBe(false);
    const negative = EnvSchema.safeParse({ MOCK_FAULT_RATE: "-0.1" });
    expect(negative.success).toBe(false);
  });

  it("rejects MOCK_FAULT_RATE that isn't numeric", () => {
    const result = EnvSchema.safeParse({ MOCK_FAULT_RATE: "not-a-number" });
    expect(result.success).toBe(false);
  });

  it("accepts only known NODE_ENV values", () => {
    const valid = EnvSchema.safeParse({ NODE_ENV: "production" });
    expect(valid.success).toBe(true);
    const invalid = EnvSchema.safeParse({ NODE_ENV: "staging" });
    expect(invalid.success).toBe(false);
  });

  it("OPENAI_MODEL has a sensible default", () => {
    const result = EnvSchema.safeParse({});
    if (result.success) {
      expect(result.data.OPENAI_MODEL).toBe("gpt-4o");
    }
  });
});
