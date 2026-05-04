import "server-only";

import { z } from "zod";

//env variable schema
//every env var the app reads is declared here. Parsed once at module load
//fails fast with a clear message if anything is malformed.
const EnvSchema = z.object({
  // db
  DATABASE_URL: z.string().min(1).optional(),

  // trigger.dev confs
  TRIGGER_PROJECT_REF: z.string().min(1).optional(),
  TRIGGER_API_KEY: z.string().min(1).optional(),
  TRIGGER_SECRET_KEY: z.string().min(1).optional(),

  // openAI (vision provider)
  OPENAI_API_KEY: z.string().regex(/^sk-/, "OPENAI_API_KEY must start with 'sk-'").optional(),
  OPENAI_MODEL: z.string().default("gpt-4o"),

  // mock mode controls
  MOCK_FAULT_RATE: z.coerce.number().min(0).max(1).default(0),

  // node env (set by Next.js / Vitest)
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof EnvSchema>;

function parseEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}\n\nFix .env and restart.`);
  }
  return result.data;
}

export const env: Env = parseEnv();
