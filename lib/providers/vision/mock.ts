import type { VisionExtractionResult, VisionProvider } from "./types";

const CANONICAL_GROCERY_LIST = [
  "milk",
  "eggs",
  "bananas",
  "pasta x2",
  "tomatoes",
  "greek yoghurt",
  "oat milk maybe",
  "cereal",
  "chicken breast",
  "washing up liquid",
].join("\n");

export class MockVisionProvider implements VisionProvider {
  readonly name = "mock";

  async extractText(_input: {
    imageBytes: Uint8Array;
    mime: string;
  }): Promise<VisionExtractionResult> {
    return {
      rawText: CANONICAL_GROCERY_LIST,
      confidence: 0.95,
      rawProviderResponse: {
        provider: "mock",
        note: "deterministic transcription matching public/demo/grocery-note-sample.webp",
      },
    };
  }
}
