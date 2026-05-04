import { afterEach, describe, expect, it, vi } from "vitest";

import { OpenAiVisionProvider } from "@/lib/providers/vision/openai";

// Mock the OpenAI SDK before any module imports it.
const mockCreate = vi.hoisted(() => vi.fn());

vi.mock("openai", () => ({
  default: function MockOpenAI() {
    return { chat: { completions: { create: mockCreate } } };
  },
}));

afterEach(() => {
  mockCreate.mockClear();
});

describe("OpenAiVisionProvider", () => {
  it("provider name is exposed for logging", () => {
    const provider = new OpenAiVisionProvider({ apiKey: "sk-test" });
    expect(provider.name).toBe("openai-gpt-4o");
  });

  it("calls chat.completions.create with the configured model", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "milk\neggs\nbananas" } }],
    });

    const provider = new OpenAiVisionProvider({
      apiKey: "sk-test",
      model: "gpt-4o-mini",
    });
    await provider.extractText({
      imageBytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
      mime: "image/png",
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockCreate.mock.calls[0]![0];
    expect(callArgs.model).toBe("gpt-4o-mini");
    expect(callArgs.messages).toHaveLength(2);
    expect(callArgs.messages[0].role).toBe("system");
    expect(callArgs.messages[1].role).toBe("user");
    expect(callArgs.max_tokens).toBe(1024);
  });

  it("encodes image bytes as a base64 data URL", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "test" } }],
    });

    const provider = new OpenAiVisionProvider({ apiKey: "sk-test" });
    const imageBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    await provider.extractText({ imageBytes, mime: "image/png" });

    const userMessage = mockCreate.mock.calls[0]![0].messages[1];
    expect(userMessage.content[1].type).toBe("image_url");
    const url: string = userMessage.content[1].image_url.url;
    expect(url.startsWith("data:image/png;base64,")).toBe(true);

    expect(url).toBe("data:image/png;base64,iVBORw==");
  });

  it("returns the trimmed text content", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "  milk\neggs\n  " } }],
    });

    const provider = new OpenAiVisionProvider({ apiKey: "sk-test" });
    const result = await provider.extractText({
      imageBytes: new Uint8Array([0]),
      mime: "image/png",
    });

    expect(result.rawText).toBe("milk\neggs");
    expect(result.confidence).toBe(0.9);
    expect(result.rawProviderResponse).toBeDefined();
  });

  it("returns empty rawText when the model returns no content", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    const provider = new OpenAiVisionProvider({ apiKey: "sk-test" });
    const result = await provider.extractText({
      imageBytes: new Uint8Array([0]),
      mime: "image/png",
    });

    expect(result.rawText).toBe("");
  });

  it("uses gpt-4o by default when model is not specified", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "test" } }],
    });

    const provider = new OpenAiVisionProvider({ apiKey: "sk-test" });
    await provider.extractText({
      imageBytes: new Uint8Array([0]),
      mime: "image/png",
    });

    expect(mockCreate.mock.calls[0]![0].model).toBe("gpt-4o");
  });
});
