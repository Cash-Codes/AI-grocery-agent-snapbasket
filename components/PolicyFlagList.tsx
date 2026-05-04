import type { PolicyFlag } from "@/lib/domain/types";
import { policyFlagColor } from "@/lib/ui/status-color";

const FLAG_LABELS: Record<PolicyFlag["kind"], string> = {
  BUDGET_EXCEEDED: "Budget exceeded",
  ALLERGEN_DETECTED: "Allergen",
  DIETARY_VIOLATION: "Dietary",
  LOW_CONFIDENCE_MATCH: "Low confidence",
  UNAVAILABLE_PRODUCT: "Unavailable",
  SUBSTITUTION_APPLIED: "Substituted",
};

function describe(flag: PolicyFlag): string {
  switch (flag.kind) {
    case "BUDGET_EXCEEDED":
      return `£${(flag.actualPence / 100).toFixed(2)} > £${(flag.maxPence / 100).toFixed(2)}`;
    case "ALLERGEN_DETECTED":
      return flag.allergen;
    case "DIETARY_VIOLATION":
      return flag.rule.replace(/_/g, " ");
    case "LOW_CONFIDENCE_MATCH":
      return `${(flag.confidence * 100).toFixed(0)}%`;
    case "UNAVAILABLE_PRODUCT":
      return flag.substitution ? `→ ${flag.substitution.name}` : "";
    case "SUBSTITUTION_APPLIED":
      return `${flag.original} → ${flag.substitute}`;
  }
}

export function PolicyFlagList({ flags }: { flags: PolicyFlag[] }) {
  if (flags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {flags.map((flag, idx) => (
        <span
          key={idx}
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs ${policyFlagColor(flag.kind)}`}
        >
          <span className="font-medium">{FLAG_LABELS[flag.kind]}</span>
          {describe(flag) && <span className="opacity-75">·</span>}
          {describe(flag) && <span>{describe(flag)}</span>}
        </span>
      ))}
    </div>
  );
}
