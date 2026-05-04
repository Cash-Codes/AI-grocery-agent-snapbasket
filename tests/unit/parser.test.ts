import { describe, expect, it } from "vitest";

import { parseGroceryLine, parseGroceryText } from "@/lib/parser/intent";

describe("parseGroceryLine", () => {
  it("parses a simple single-word item", () => {
    const result = parseGroceryLine("milk");
    expect(result).not.toBeNull();
    expect(result?.canonicalName).toBe("milk");
    expect(result?.quantity).toBe(1);
    expect(result?.unit).toBe("item");
    expect(result?.category).toBe("dairy");
    expect(result?.needsClarification).toBe(false);
  });

  it("parses trailing quantity (pasta x2)", () => {
    const result = parseGroceryLine("pasta x2");
    expect(result?.canonicalName).toBe("pasta");
    expect(result?.quantity).toBe(2);
    expect(result?.unit).toBe("item");
    expect(result?.category).toBe("pantry");
  });

  it("parses unit-prefixed quantity (2L milk)", () => {
    const result = parseGroceryLine("2L milk");
    expect(result?.canonicalName).toBe("milk");
    expect(result?.quantity).toBe(2);
    expect(result?.unit).toBe("l");
    expect(result?.category).toBe("dairy");
  });

  it("parses kg quantity (1kg chicken breast)", () => {
    const result = parseGroceryLine("1kg chicken breast");
    expect(result?.canonicalName).toBe("chicken breast");
    expect(result?.quantity).toBe(1);
    expect(result?.unit).toBe("kg");
    expect(result?.category).toBe("meat");
  });

  it("preserves multi-word names", () => {
    const result = parseGroceryLine("greek yoghurt");
    expect(result?.canonicalName).toBe("greek yogurt");
    expect(result?.category).toBe("dairy");
  });

  it("flags clarification on hedge word 'maybe'", () => {
    const result = parseGroceryLine("oat milk maybe");
    expect(result?.canonicalName).toBe("oat milk");
    expect(result?.needsClarification).toBe(true);
    expect(result?.clarificationReason).toMatch(/hedge.*maybe/i);
    expect(result?.confidence).toBeLessThan(0.95);
  });

  it("flags clarification on trailing question mark", () => {
    const result = parseGroceryLine("almonds?");
    expect(result?.canonicalName).toBe("almonds");
    expect(result?.needsClarification).toBe(true);
  });

  it("returns null for empty line", () => {
    expect(parseGroceryLine("")).toBeNull();
    expect(parseGroceryLine("   ")).toBeNull();
  });

  it("trims surrounding whitespace before parsing", () => {
    const result = parseGroceryLine("   bananas   ");
    expect(result?.originalText).toBe("bananas");
    expect(result?.canonicalName).toBe("banana");
  });

  it("preserves the originalText untouched", () => {
    const result = parseGroceryLine("Pasta X3");
    expect(result?.originalText).toBe("Pasta X3");
    expect(result?.canonicalName).toBe("pasta");
    expect(result?.quantity).toBe(3);
  });
});

describe("parseGroceryText", () => {
  it("parses the canonical mock transcription into 10 intents", () => {
    const rawText = [
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

    const result = parseGroceryText(rawText);
    expect(result).toHaveLength(10);

    const byName = (n: string) => result.find((r) => r.canonicalName === n);
    expect(byName("milk")?.category).toBe("dairy");
    // "eggs" → "egg" via normalize, no inferCategory rule → "other".
    // This is intentional - eggs are taxonomically borderline (dairy vs bakery vs own section).
    expect(byName("egg")?.category).toBe("other");
    expect(byName("banana")?.category).toBe("produce");
    expect(byName("pasta")?.quantity).toBe(2);
    expect(byName("tomato")?.category).toBe("produce");
    expect(byName("greek yogurt")?.category).toBe("dairy");

    const oatMilk = byName("oat milk");
    expect(oatMilk?.needsClarification).toBe(true);

    expect(byName("cereal")?.category).toBe("pantry");
    expect(byName("chicken breast")?.category).toBe("meat");
    expect(byName("washing up liquid")?.category).toBe("household");
  });

  it("ignores empty lines between entries", () => {
    const result = parseGroceryText("milk\n\n\neggs\n");
    expect(result).toHaveLength(2);
  });
});
