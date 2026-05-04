import type { EventStatus, PolicyFlag, RunStatus } from "@/lib/domain/types";

export const RUN_STATUS_COLOR: Record<RunStatus, string> = {
  PENDING: "bg-zinc-100 text-zinc-700",
  RUNNING: "bg-blue-100 text-blue-700",
  AWAITING_APPROVAL: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
  TIMED_OUT: "bg-zinc-100 text-zinc-600",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-red-100 text-red-700",
};

export const EVENT_STATUS_COLOR: Record<EventStatus, string> = {
  started: "text-zinc-500",
  succeeded: "text-emerald-600",
  failed: "text-red-600",
  retrying: "text-amber-600",
};

export function policyFlagColor(kind: PolicyFlag["kind"]): string {
  switch (kind) {
    case "BUDGET_EXCEEDED":
    case "ALLERGEN_DETECTED":
      return "bg-red-100 text-red-700";
    case "DIETARY_VIOLATION":
    case "UNAVAILABLE_PRODUCT":
      return "bg-amber-100 text-amber-700";
    case "LOW_CONFIDENCE_MATCH":
    case "SUBSTITUTION_APPLIED":
      return "bg-zinc-100 text-zinc-700";
  }
}
