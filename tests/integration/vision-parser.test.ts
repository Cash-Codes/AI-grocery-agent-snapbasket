import { describe, expect, it } from "vitest";

import { parseGroceryText } from "@/lib/parser/intent";
import { visionProvider } from "@/lib/providers/vision";

describe("vision → parser end-to-end", () => {
  it("produces 10 intents from the mock transcription", async () => {
    const dummyImage = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes; mock ignores them
    const extraction = await visionProvider.extractText({
      imageBytes: dummyImage,
      mime: "image/png",
    });

    const intents = parseGroceryText(extraction.rawText);
    expect(intents).toHaveLength(10);

    const names = intents.map((i) => i.canonicalName);
    expect(names).toContain("milk");
    expect(names).toContain("greek yogurt");
    expect(names).toContain("oat milk");
    expect(names).toContain("chicken breast");
  });

  it("the oat milk hedge is propagated through the pipeline", async () => {
    const dummyImage = new Uint8Array([0]);
    const extraction = await visionProvider.extractText({
      imageBytes: dummyImage,
      mime: "image/png",
    });

    const intents = parseGroceryText(extraction.rawText);
    const oatMilk = intents.find((i) => i.canonicalName === "oat milk");
    expect(oatMilk?.needsClarification).toBe(true);
    expect(oatMilk?.clarificationReason).toMatch(/hedge/i);
  });

  it("vision provider name is exposed for logging", () => {
    expect(visionProvider.name).toBe("mock");
  });
});
