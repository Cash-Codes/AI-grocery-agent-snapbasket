import type { EventStatus, PolicyFlag, RunStatus } from "@/lib/domain/types";

// dark-mode tuned: subtle tinted backgrounds + matching foreground per state
export const RUN_STATUS_COLOR: Record<RunStatus, string> = {
  PENDING: "bg-secondary/80 text-muted-foreground border border-border/60",
  RUNNING: "bg-primary/10 text-primary border border-primary/30",
  AWAITING_APPROVAL: "bg-accent/15 text-accent border border-accent/35",
  APPROVED: "bg-primary/15 text-primary border border-primary/35",
  REJECTED: "bg-destructive/15 text-destructive border border-destructive/35",
  TIMED_OUT: "bg-secondary/60 text-muted-foreground border border-border/50",
  COMPLETED: "bg-primary/15 text-primary border border-primary/35",
  FAILED: "bg-destructive/15 text-destructive border border-destructive/35",
};

export const EVENT_STATUS_COLOR: Record<EventStatus, string> = {
  started: "text-muted-foreground",
  succeeded: "text-primary",
  failed: "text-destructive",
  retrying: "text-accent",
};

export function policyFlagColor(kind: PolicyFlag["kind"]): string {
  switch (kind) {
    case "BUDGET_EXCEEDED":
    case "ALLERGEN_DETECTED":
      return "bg-destructive/12 text-destructive border border-destructive/30";
    case "DIETARY_VIOLATION":
    case "UNAVAILABLE_PRODUCT":
      return "bg-accent/15 text-accent border border-accent/35";
    case "LOW_CONFIDENCE_MATCH":
    case "SUBSTITUTION_APPLIED":
      return "bg-secondary/80 text-muted-foreground border border-border/60";
  }
}
