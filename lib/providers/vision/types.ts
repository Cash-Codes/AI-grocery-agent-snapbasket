export interface VisionExtractionResult {
  rawText: string;
  confidence: number;
  rawProviderResponse: unknown;
}

export interface VisionProvider {
  readonly name: string;
  extractText(input: { imageBytes: Uint8Array; mime: string }): Promise<VisionExtractionResult>;
}
