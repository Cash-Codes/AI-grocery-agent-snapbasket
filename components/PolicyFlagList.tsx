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
    <div className="flex flex-wrap gap-1.5">
      {flags.map((flag, idx) => {
        const detail = describe(flag);
        return (
          <span
            key={idx}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.12em] ${policyFlagColor(flag.kind)}`}
          >
            <span aria-hidden className="bg-current size-1 rounded-full opacity-80" />
            <span className="font-semibold">{FLAG_LABELS[flag.kind]}</span>
            {detail && <span className="opacity-60">·</span>}
            {detail && <span className="font-normal normal-case tracking-normal">{detail}</span>}
          </span>
        );
      })}
    </div>
  );
}
