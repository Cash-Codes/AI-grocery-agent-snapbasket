import { MockVisionProvider } from "./mock";
import type { VisionProvider } from "./types";

export type { VisionExtractionResult, VisionProvider } from "./types";

export const visionProvider: VisionProvider = new MockVisionProvider();
