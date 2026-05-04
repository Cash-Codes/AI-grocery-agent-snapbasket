import { describe, expect, it } from "vitest";

import { inferCategory, normalizeName } from "@/lib/parser/normalize";

describe("normalizeName", () => {
  it("collapses common plurals to singulars via lookup", () => {
    expect(normalizeName("tomatoes")).toBe("tomato");
    expect(normalizeName("bananas")).toBe("banana");
    expect(normalizeName("eggs")).toBe("egg");
  });

  it("normalizes spelling variants (yoghurt → yogurt)", () => {
    expect(normalizeName("yoghurt")).toBe("yogurt");
    expect(normalizeName("greek yoghurt")).toBe("greek yogurt");
  });

  it("returns the input lowercased + trimmed when no rule matches", () => {
    expect(normalizeName("  Cereal  ")).toBe("cereal");
    expect(normalizeName("washing up liquid")).toBe("washing up liquid");
  });

  it("handles naive trailing-s singularization for unmapped words", () => {
    expect(normalizeName("carrots")).toBe("carrot");
  });

  it("returns empty string for empty/whitespace-only input", () => {
    expect(normalizeName("")).toBe("");
    expect(normalizeName("   ")).toBe("");
  });
});

describe("inferCategory", () => {
  it("assigns dairy keywords correctly", () => {
    expect(inferCategory("milk")).toBe("dairy");
    expect(inferCategory("greek yogurt")).toBe("dairy");
    expect(inferCategory("cheddar cheese")).toBe("dairy");
  });

  it("assigns produce keywords correctly", () => {
    expect(inferCategory("banana")).toBe("produce");
    expect(inferCategory("tomato")).toBe("produce");
  });

  it("assigns household keywords correctly", () => {
    expect(inferCategory("washing up liquid")).toBe("household");
    expect(inferCategory("paper towel")).toBe("household");
  });

  it("assigns meat keywords correctly", () => {
    expect(inferCategory("chicken breast")).toBe("meat");
    expect(inferCategory("salmon fillet")).toBe("meat");
  });

  it("assigns pantry keywords correctly", () => {
    expect(inferCategory("pasta")).toBe("pantry");
    expect(inferCategory("cereal")).toBe("pantry");
  });

  it("respects rule order: ice cream → frozen, not dairy", () => {
    expect(inferCategory("ice cream")).toBe("frozen");
  });

  it("falls back to 'other' when no pattern matches", () => {
    expect(inferCategory("widget")).toBe("other");
    expect(inferCategory("")).toBe("other");
  });
});
