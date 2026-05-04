import "server-only";

import OpenAI from "openai";

import type { VisionExtractionResult, VisionProvider } from "./types";

const SYSTEM_PROMPT = `You are a transcription tool for grocery lists.

The image shows a handwritten or printed grocery list. Output the items exactly as written, one per line, with no commentary, headers, numbering, or formatting. Preserve quantities and qualifiers as written (e.g., "pasta x2", "oat milk maybe", "2 pints milk"). If a line is illegible, output "[illegible]" for that line.

If the image does not contain a grocery list, respond with the single line "no grocery list detected".`;

export interface OpenAiVisionProviderOptions {
  apiKey: string;
  model?: string;
}

export class OpenAiVisionProvider implements VisionProvider {
  readonly name = "openai-gpt-4o";

  private readonly client: OpenAI;
  private readonly model: string;

  constructor(options: OpenAiVisionProviderOptions) {
    this.client = new OpenAI({ apiKey: options.apiKey });
    this.model = options.model ?? "gpt-4o";
  }

  async extractText(input: {
    imageBytes: Uint8Array;
    mime: string;
  }): Promise<VisionExtractionResult> {
    const dataUrl = `data:${input.mime};base64,${Buffer.from(input.imageBytes).toString("base64")}`;

    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Transcribe this grocery list." },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      // Restrict output to the transcription itself, no chain of thought.
      max_tokens: 1024,
    });

    const rawText = completion.choices[0]?.message.content?.trim() ?? "";

    return {
      rawText,
      // gpt-4o doesn't return per output confidence cleanly. Use a fixed value
      // slightly below the mock's 0.95 to indicate "real-world variance".
      // we'll polish this later on
      confidence: 0.9,
      rawProviderResponse: completion,
    };
  }
}
