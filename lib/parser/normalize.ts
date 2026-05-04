import type { ProductCategory } from "@/lib/domain/types";

//Canonical name lookup table. Maps common variants/plurals to a single canonical form.
// Adding entries is cheap, the cost is curation.
const CANONICAL_NAMES: Record<string, string> = {
  // dairy
  yoghurt: "yogurt",
  "greek yoghurt": "greek yogurt",
  // produce
  tomatoes: "tomato",
  bananas: "banana",
  apples: "apple",
  onions: "onion",
  carrots: "carrot",
  potatoes: "potato",
  // pantry
  eggs: "egg",
};

//Order matters: more specific patterns must come before generic ones. "ice cream" must match `frozen` before "cream" matches `dairy`.
const CATEGORY_RULES: Array<{ pattern: RegExp; category: ProductCategory }> = [
  { pattern: /\bice cream\b/i, category: "frozen" },
  {
    pattern: /\b(milk|cheese|yog[h]?urt|butter|cream|mozzarella|cheddar|brie)\b/i,
    category: "dairy",
  },
  {
    pattern:
      /\b(banana|tomato|apple|onion|carrot|potato|lettuce|cucumber|pepper|spinach|broccoli|garlic)\b/i,
    category: "produce",
  },
  {
    pattern: /\b(chicken|beef|pork|salmon|tuna|fish|turkey|lamb|bacon|sausage|ham)\b/i,
    category: "meat",
  },
  { pattern: /\b(bread|baguette|croissant|bagel|pastry|roll)\b/i, category: "bakery" },
  { pattern: /\b(juice|water|soda|tea|coffee|beer|wine|lemonade)\b/i, category: "beverages" },
  {
    pattern: /\b(washing|soap|detergent|cleaner|tissue|paper towel|sponge)\b/i,
    category: "household",
  },
  {
    pattern: /\b(pasta|rice|cereal|flour|sugar|salt|oats|noodles|crackers|biscuits|cookies)\b/i,
    category: "pantry",
  },
  { pattern: /\bfrozen\b/i, category: "frozen" },
];

export function normalizeName(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (trimmed.length === 0) return "";
  const direct = CANONICAL_NAMES[trimmed];
  if (direct) return direct;
  //plural handling for unmapped words.
  if (trimmed.endsWith("s")) {
    const singular = trimmed.slice(0, -1);
    const direct2 = CANONICAL_NAMES[singular];
    if (direct2) return direct2;
  }
  return trimmed;
}

export function inferCategory(canonicalName: string): ProductCategory {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(canonicalName)) {
      return rule.category;
    }
  }
  return "other";
}
