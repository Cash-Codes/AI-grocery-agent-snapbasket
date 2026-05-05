"use client";

import type { WorkflowEventRow } from "@/lib/db/schema";
import type { RunStatus } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

// pre-approval pipeline steps - account for 80% of the progress bar.
// requireHumanApproval is the milestone at 85%, finalizeMockCheckout finishes at 100%.
const PRE_APPROVAL_STEPS = [
  "ingestImage",
  "extractRawTextFromImage",
  "parseGroceryIntent",
  "normalizeItems",
  "enrichItems",
  "matchProducts",
  "buildBasket",
  "validateBasketPolicy",
] as const;

const STEP_RUNNING_LABEL: Record<string, string> = {
  ingestImage: "Ingesting image...",
  extractRawTextFromImage: "Extracting text from image...",
  parseGroceryIntent: "Parsing grocery items...",
  normalizeItems: "Normalizing item names...",
  enrichItems: "Enriching items...",
  matchProducts: "Matching products against catalog...",
  buildBasket: "Building basket...",
  validateBasketPolicy: "Validating policy...",
  requireHumanApproval: "Awaiting your approval...",
  finalizeMockCheckout: "Finalizing checkout...",
};

type ProgressState = "running" | "awaiting" | "complete" | "rejected" | "failed";

interface ComputedProgress {
  pct: number;
  label: string;
  state: ProgressState;
}

function tsOf(ts: string | Date): number {
  return ts instanceof Date ? ts.getTime() : new Date(ts).getTime();
}

function compute(events: WorkflowEventRow[], status: RunStatus): ComputedProgress {
  if (status === "COMPLETED") return { pct: 100, label: "Run complete", state: "complete" };
  if (status === "REJECTED") return { pct: 100, label: "Run rejected", state: "rejected" };
  if (status === "TIMED_OUT") return { pct: 100, label: "Approval timed out", state: "rejected" };
  if (status === "FAILED") {
    // pin to whatever the bar reached when it failed
    const completed = new Set(events.filter((e) => e.status === "succeeded").map((e) => e.step));
    const fraction = PRE_APPROVAL_STEPS.filter((s) => completed.has(s)).length;
    const pct = Math.max(20, (fraction / PRE_APPROVAL_STEPS.length) * 100);
    return { pct, label: "Workflow failed", state: "failed" };
  }
  if (status === "AWAITING_APPROVAL")
    return { pct: 85, label: "Awaiting your approval", state: "awaiting" };
  if (status === "APPROVED") return { pct: 95, label: "Finalizing checkout...", state: "running" };

  // RUNNING (or PENDING) - compute fraction of pre-approval steps completed,
  // including partial progress within fan-out steps (matchProducts, enrichItems
  // run once per intent so we credit each invocation).
  let completedFraction = 0;
  for (const step of PRE_APPROVAL_STEPS) {
    const stepEvents = events.filter((e) => e.step === step);
    const startedCount = stepEvents.filter((e) => e.status === "started").length;
    const succeededCount = stepEvents.filter((e) => e.status === "succeeded").length;
    if (startedCount === 0) continue;
    if (succeededCount >= startedCount) {
      completedFraction += 1;
    } else {
      completedFraction += succeededCount / startedCount;
    }
  }
  const pct = Math.min(80, (completedFraction / PRE_APPROVAL_STEPS.length) * 80);

  // Pick the latest in-flight step for the label.
  const inFlight = events
    .filter((e) => e.status === "started" || e.status === "retrying")
    .sort((a, b) => tsOf(b.timestamp) - tsOf(a.timestamp))[0];
  const allCompletedSteps = new Set(
    events.filter((e) => e.status === "succeeded").map((e) => e.step),
  );
  const currentStep = inFlight && !allCompletedSteps.has(inFlight.step) ? inFlight.step : null;
  const label = currentStep ? (STEP_RUNNING_LABEL[currentStep] ?? "Running...") : "Starting up...";

  return { pct, label, state: "running" };
}

export interface RunProgressProps {
  events: WorkflowEventRow[];
  status: RunStatus;
}

export function RunProgress({ events, status }: RunProgressProps) {
  const { pct, label, state } = compute(events, status);
  const isActive = state === "running" || state === "awaiting";
  const isError = state === "failed" || state === "rejected";

  return (
    <div
      className="animate-fade-up space-y-2"
      style={{ ["--stagger" as string]: "40ms" }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span
          className={cn(
            "text-foreground/85 inline-flex items-center gap-2 text-[13px] font-medium",
            isError && "text-destructive",
          )}
        >
          {state === "running" && (
            <span aria-hidden className="relative inline-flex size-1.5">
              <span className="bg-primary absolute inset-0 animate-pulse-ring rounded-full" />
              <span className="bg-primary relative inline-flex size-1.5 rounded-full" />
            </span>
          )}
          {state === "awaiting" && (
            <span aria-hidden className="relative inline-flex size-1.5">
              <span className="bg-accent absolute inset-0 animate-pulse-ring rounded-full" />
              <span className="bg-accent relative inline-flex size-1.5 rounded-full" />
            </span>
          )}
          {state === "complete" && (
            <span aria-hidden className="bg-primary inline-block size-1.5 rounded-full" />
          )}
          {isError && (
            <span aria-hidden className="bg-destructive inline-block size-1.5 rounded-full" />
          )}
          {label}
        </span>
        <span className="text-muted-foreground/70 font-num font-mono text-[10.5px] tabular-nums">
          {Math.round(pct)}%
        </span>
      </div>

      <div
        className="bg-secondary ring-border/60 relative h-1.5 overflow-hidden rounded-full ring-1"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            "absolute inset-y-0 left-0 overflow-hidden rounded-full transition-[width] duration-700 ease-out",
            state === "failed"
              ? "bg-destructive"
              : state === "rejected"
                ? "bg-muted-foreground/50"
                : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        >
          {/* moving sheen overlay while the bar is active */}
          {isActive && (
            <div
              aria-hidden
              className="h-full w-full"
              style={{
                background: "linear-gradient(90deg, transparent, oklch(1 0 0 / 0.35), transparent)",
                backgroundSize: "200% 100%",
                animation: "shimmer 2s linear infinite",
              }}
            />
          )}
        </div>

        {/* leading-edge glow dot when actively running */}
        {state === "running" && pct > 4 && pct < 99 && (
          <span
            aria-hidden
            className="bg-primary absolute top-1/2 size-2 -translate-y-1/2 rounded-full"
            style={{
              left: `calc(${pct}% - 4px)`,
              boxShadow: "0 0 0 4px oklch(0.55 0.165 153 / 0.18)",
              animation: "pulse-soft 1.6s ease-in-out infinite",
            }}
          />
        )}
      </div>
    </div>
  );
}
