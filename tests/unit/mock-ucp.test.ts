import { describe, expect, it } from "vitest";

import { commerceProvider } from "@/lib/providers/commerce";

describe("MockUcpCommerceProvider.searchProducts", () => {
  it("returns multiple matches for 'milk' across dairy items", async () => {
    const matches = await commerceProvider.searchProducts({
      canonicalName: "milk",
      limit: 10,
    });
    expect(matches.length).toBeGreaterThanOrEqual(2); // whole + semi-skimmed + oat at minimum
    expect(matches.every((m) => m.score > 0)).toBe(true);
  });

  it("ranks exact-token matches above substring matches", async () => {
    const matches = await commerceProvider.searchProducts({
      canonicalName: "milk",
      limit: 10,
    });
    // The whole/semi-skimmed milks have "milk" as an exact token (score 1);
    // oat milk has "oat milk" + "milk" both, the "milk" token still scores 1.
    // Anything with "milk" only as a substring of a longer token would score 0.5.
    expect(matches[0]?.score).toBe(1);
  });

  it("filters by category when provided", async () => {
    const matches = await commerceProvider.searchProducts({
      canonicalName: "bread",
      category: "bakery",
      limit: 10,
    });
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((m) => m.providerProductId.startsWith("prov_bakery"))).toBe(true);
  });

  it("returns empty array when nothing matches", async () => {
    const matches = await commerceProvider.searchProducts({
      canonicalName: "spaceship",
      limit: 10,
    });
    expect(matches).toEqual([]);
  });

  it("respects limit parameter", async () => {
    const matches = await commerceProvider.searchProducts({
      canonicalName: "pasta",
      limit: 1,
    });
    expect(matches).toHaveLength(1);
  });

  it("ranking is deterministic across runs (same query → same order)", async () => {
    const a = await commerceProvider.searchProducts({ canonicalName: "milk", limit: 10 });
    const b = await commerceProvider.searchProducts({ canonicalName: "milk", limit: 10 });
    expect(a.map((m) => m.providerProductId)).toEqual(b.map((m) => m.providerProductId));
  });

  it("provider name is exposed for logging", () => {
    expect(commerceProvider.name).toBe("mock-ucp");
  });
});
