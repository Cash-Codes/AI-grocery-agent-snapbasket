import { MockVisionProvider } from "./mock";
import { OpenAiVisionProvider } from "./openai";
import type { VisionProvider } from "./types";

import { env } from "@/lib/config/env";
import { logger } from "@/lib/observability/logger";

export type { VisionExtractionResult, VisionProvider } from "./types";

//OPENAI_API_KEY set - real OpenAI otherwise mock.
function selectProvider(): VisionProvider {
  if (env.OPENAI_API_KEY) {
    return new OpenAiVisionProvider({
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL,
    });
  }
  return new MockVisionProvider();
}

export const visionProvider: VisionProvider = selectProvider();

// log which provider is active at module load.
logger.info("vision provider selected", {
  provider: visionProvider.name,
  model: env.OPENAI_API_KEY ? env.OPENAI_MODEL : null,
});
