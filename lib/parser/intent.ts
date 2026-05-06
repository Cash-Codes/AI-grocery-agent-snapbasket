import { inferCategory, normalizeName } from "./normalize";
import type { ParsedGroceryIntent } from "./types";

// Match the trailing quantity convention eg,. x2
const TRAILING_QTY_PATTERN = /\bx\s*(\d+(?:\.\d+)?)\s*$/i;

// Match leading or embedded quantity/unit eg,. 1kg flour
const QTY_UNIT_PATTERN = /\b(\d+(?:\.\d+)?)\s*(l|ml|kg|g|oz|lb|dozen|pack|bottle|tin|can)\b/i;

// Stripped after a quantity/unit is consumed eg,. "3kg of chicken" -> "chicken"
const LEADING_PREPOSITION = /^(of|for|with|to|the|a|an)\s+/i;

// Compound separator, splits "yellow mustard + honey" into two intents.
// slash deliberately NOT included, "thighs/breast" usually means an alternative
// of one product not two distinct items.
const COMPOUND_SEPARATOR = /\s*[+&]\s*/;

// Color qualifiers that share a trailing noun in compounds. "red + green pepper"
// means "red pepper + green pepper" (both peppers), so we distribute the
// trailing noun from the multi word fragment to the single word color fragment.
// We do NOT do this for non color qualifiers like "honey" because
// "yellow mustard + honey" really IS two distinct items.
const COLOR_QUALIFIERS = new Set([
  "red",
  "green",
  "blue",
  "yellow",
  "white",
  "black",
  "brown",
  "orange",
  "purple",
  "pink",
]);

// Split a line into compound fragments, distributing a shared trailing noun
// across color-qualifier fragments when present.
function splitCompound(line: string): string[] {
  const parts = line
    .split(COMPOUND_SEPARATOR)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (parts.length < 2) return parts;

  // find the last word of the LAST multi-word fragment - that's the
  // candidate noun to share across qualifier-only fragments.
  let trailingNoun: string | null = null;
  for (let i = parts.length - 1; i >= 0; i--) {
    const words = parts[i]!.split(/\s+/);
    if (words.length >= 2) {
      trailingNoun = words[words.length - 1] ?? null;
      break;
    }
  }
  if (trailingNoun === null) return parts;

  return parts.map((part) => {
    const trimmed = part.toLowerCase().trim();
    if (COLOR_QUALIFIERS.has(trimmed)) {
      return `${part} ${trailingNoun}`;
    }
    return part;
  });
}

// Hedge detection, words/punctuation that signal uncertainty eg., if needed
const HEDGE_PATTERN = /\b(maybe|perhaps|possibly|if needed|if there is|or so)\b|\?\s*$/i;

const LOW_CONFIDENCE = 0.7;
const NORMAL_CONFIDENCE = 0.95;

// Parse a single line into a ParsedGroceryIntent. return null if line is empty after trim
export function parseGroceryLine(line: string): ParsedGroceryIntent | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) return null;

  let workingText = trimmed;
  let quantity = 1;
  let unit = "item";

  // Detect hedge words first (so we can mark and remove them from the name)
  const hedgeMatch = workingText.match(HEDGE_PATTERN);
  let needsClarification = false;
  let clarificationReason: string | null = null;
  if (hedgeMatch) {
    needsClarification = true;
    clarificationReason = `hedge phrase detected: "${hedgeMatch[0].trim()}"`;
    workingText = workingText.replace(HEDGE_PATTERN, "").trim();
  }

  // Then quantity unit eg,. 2l milk
  const qtyUnitMatch = workingText.match(QTY_UNIT_PATTERN);
  if (qtyUnitMatch?.[1] && qtyUnitMatch?.[2]) {
    quantity = parseFloat(qtyUnitMatch[1]);
    unit = qtyUnitMatch[2].toLowerCase();
    workingText = workingText.replace(QTY_UNIT_PATTERN, "").trim();
    // after a quantity is consumed, strip a leading preposition so
    // "3kg of chicken" -> "chicken" rather than "of chicken".
    workingText = workingText.replace(LEADING_PREPOSITION, "").trim();
  } else {
    // Fall back to trailing x2 style
    const trailingMatch = workingText.match(TRAILING_QTY_PATTERN);
    if (trailingMatch?.[1]) {
      quantity = parseFloat(trailingMatch[1]);
      workingText = workingText.replace(TRAILING_QTY_PATTERN, "").trim();
    }
  }

  const canonicalName = normalizeName(workingText);
  const category = inferCategory(canonicalName);

  return {
    originalText: trimmed,
    canonicalName,
    quantity,
    unit,
    category,
    confidence: needsClarification ? LOW_CONFIDENCE : NORMAL_CONFIDENCE,
    needsClarification,
    clarificationReason,
  };
}

//Parse a multi line grocery transcription into an array of ParsedGroceryIntent. empty/whitesapce lines are dropped
export function parseGroceryText(rawText: string): ParsedGroceryIntent[] {
  return rawText
    .split("\n")
    .flatMap(splitCompound)
    .map(parseGroceryLine)
    .filter((intent): intent is ParsedGroceryIntent => intent !== null);
}
