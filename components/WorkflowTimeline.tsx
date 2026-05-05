"use client";

import { Check, ChevronRight, CircleDashed, RotateCw, X } from "lucide-react";
import { useState } from "react";

import type { WorkflowEventRow } from "@/lib/db/schema";
import type { EventStatus } from "@/lib/domain/types";
import { formatDuration } from "@/lib/ui/format";
import { cn } from "@/lib/utils";

const STEP_LABELS: Record<string, string> = {
  ingestImage: "Ingest image",
  extractRawTextFromImage: "Extract text",
  parseGroceryIntent: "Parse intent",
  normalizeItems: "Normalize",
  enrichItems: "Enrich",
  matchProducts: "Match products",
  buildBasket: "Build basket",
  validateBasketPolicy: "Validate policy",
  requireHumanApproval: "Await approval",
  finalizeMockCheckout: "Finalize checkout",
};

// Plain-language explainer per step. Surfaced when a row is expanded so a
// reviewer can see what each task does without reading source.
const STEP_DESCRIPTIONS: Record<string, string> = {
  ingestImage: "Hash the uploaded image, dedup against prior runs, and persist the bytes to disk.",
  extractRawTextFromImage:
    "Send the image to the vision provider (mock or OpenAI) and get back a raw transcription of what's written on the list.",
  parseGroceryIntent:
    "Split the transcription into per-item intents - extract quantity, unit, hedge phrases, and a canonical name per line. Compound items (“red + green pepper”) split into separate intents here.",
  normalizeItems:
    "Apply canonical name mappings (e.g. “tomatoes” → “tomato”, “yoghurt” → “yogurt”) and infer a category for each intent.",
  enrichItems:
    "Pass through hook for any future enrichment (synonyms, brand expansion, dietary tagging). Currently a no-op for forward compatibility. Runs once per intent so it's a fan out task.",
  matchProducts:
    "Search the commerce catalog for each intent. Returns up to 5 candidates ranked by word set overlap score, the top match is auto selected. Runs once per intent so it's a fan out task.",
  buildBasket:
    "Pick every selected candidate from this run, assemble a basket with deterministic idempotency so retries don't double up.",
  validateBasketPolicy:
    "Run the basket through policy rules - budget, allergens, dietary restrictions, low confidence matches. Any flag triggers explicit approval.",
  requireHumanApproval:
    "Persist a Trigger.dev waitpoint and pause the workflow durably until a user approves or rejects (or 24h timeout).",
  finalizeMockCheckout:
    "Create a mock checkout session against the commerce provider once approval lands. Real retailer integration is intentionally out of scope.",
};

function StatusIcon({ status }: { status: EventStatus }) {
  switch (status) {
    case "started":
      return (
        <CircleDashed
          className="text-muted-foreground size-3.5 animate-spin"
          style={{ animationDuration: "3s" }}
          strokeWidth={1.75}
        />
      );
    case "succeeded":
      return <Check className="text-primary size-3.5" strokeWidth={2.25} />;
    case "failed":
      return <X className="text-destructive size-3.5" strokeWidth={2.25} />;
    case "retrying":
      return <RotateCw className="text-accent size-3.5 animate-spin" strokeWidth={2.25} />;
  }
}

function statusRingClass(status: EventStatus): string {
  switch (status) {
    case "started":
      return "border-border bg-secondary/60";
    case "succeeded":
      return "border-primary/40 bg-primary/15";
    case "failed":
      return "border-destructive/40 bg-destructive/15";
    case "retrying":
      return "border-accent/40 bg-accent/15";
  }
}

interface PayloadEntry {
  key: string;
  value: string;
}

function formatPayload(payloadJson: string | null): PayloadEntry[] {
  if (!payloadJson) return [];
  try {
    const parsed = JSON.parse(payloadJson) as Record<string, unknown>;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return [];
    return Object.entries(parsed).map(([key, value]) => ({
      key,
      value:
        value === null
          ? "null"
          : typeof value === "string"
            ? value
            : typeof value === "number" || typeof value === "boolean"
              ? String(value)
              : JSON.stringify(value),
    }));
  } catch {
    return [];
  }
}

function tsOf(ts: string | Date): number {
  return ts instanceof Date ? ts.getTime() : new Date(ts).getTime();
}

interface AggregatedStep {
  step: string;
  events: WorkflowEventRow[];
  finalStatus: EventStatus;
  invocationCount: number; // distinct "started" events (excludes retries)
  succeededCount: number;
  failedCount: number;
  retryCount: number;
  totalDurationMs: number;
  isComplete: boolean;
}

// Group raw events by step into one logical row per step. For fan-out tasks
// (matchProducts, enrichItems run once per intent) this collapses N events
// into a single "× N invocations" row instead of flooding the timeline.
function aggregate(events: WorkflowEventRow[]): AggregatedStep[] {
  const byStep = new Map<string, WorkflowEventRow[]>();
  for (const e of events) {
    let arr = byStep.get(e.step);
    if (!arr) {
      arr = [];
      byStep.set(e.step, arr);
    }
    arr.push(e);
  }

  const groups: AggregatedStep[] = [];
  for (const [step, evts] of byStep) {
    const sorted = [...evts].sort((a, b) => tsOf(a.timestamp) - tsOf(b.timestamp));
    const startedCount = sorted.filter((e) => e.status === "started").length;
    const succeededCount = sorted.filter((e) => e.status === "succeeded").length;
    const failedCount = sorted.filter((e) => e.status === "failed").length;
    const retryCount = sorted.filter((e) => e.status === "retrying").length;

    let finalStatus: EventStatus;
    if (failedCount > 0) finalStatus = "failed";
    else if (succeededCount >= startedCount && startedCount > 0) finalStatus = "succeeded";
    else if (retryCount > 0) finalStatus = "retrying";
    else finalStatus = "started";

    const isComplete = startedCount > 0 && (succeededCount >= startedCount || failedCount > 0);

    const firstTs = tsOf(sorted[0]!.timestamp);
    const lastTs = tsOf(sorted[sorted.length - 1]!.timestamp);
    const totalDurationMs = isComplete ? lastTs - firstTs : 0;

    groups.push({
      step,
      events: sorted,
      finalStatus,
      invocationCount: Math.max(startedCount, 1),
      succeededCount,
      failedCount,
      retryCount,
      totalDurationMs,
      isComplete,
    });
  }

  // Workflow execution order = order of the first event per step
  groups.sort((a, b) => tsOf(a.events[0]!.timestamp) - tsOf(b.events[0]!.timestamp));
  return groups;
}

// Pick the "most informative" payload across a step's events for the expanded
// view: the latest succeeded event with a non-empty payload, falling back to
// the latest event with any payload.
function representativePayload(events: WorkflowEventRow[]): PayloadEntry[] {
  const succeeded = [...events].filter((e) => e.status === "succeeded" && e.payloadJson).reverse();
  for (const e of succeeded) {
    const entries = formatPayload(e.payloadJson);
    if (entries.length > 0) return entries;
  }
  const any = [...events].filter((e) => e.payloadJson).reverse();
  for (const e of any) {
    const entries = formatPayload(e.payloadJson);
    if (entries.length > 0) return entries;
  }
  return [];
}

export interface WorkflowTimelineProps {
  events: WorkflowEventRow[];
}

export function WorkflowTimeline({ events }: WorkflowTimelineProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(step: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(step)) next.delete(step);
      else next.add(step);
      return next;
    });
  }

  if (events.length === 0) {
    return (
      <p className="text-muted-foreground/70 font-mono text-[11.5px] uppercase tracking-[0.18em]">
        Waiting for the first event...
      </p>
    );
  }

  const groups = aggregate(events);

  return (
    <ol className="relative space-y-1">
      {/* vertical rail */}
      <span aria-hidden className="bg-border/50 absolute bottom-2 left-[11px] top-2 w-px" />
      {groups.map((group) => {
        const label = STEP_LABELS[group.step] ?? group.step;
        const description = STEP_DESCRIPTIONS[group.step];
        const payloadEntries = representativePayload(group.events);
        const hasDetails = Boolean(description) || payloadEntries.length > 0;
        const isFanout = group.invocationCount > 1;
        const isActive = group.finalStatus === "started" || group.finalStatus === "retrying";
        const isExpanded = expanded.has(group.step);

        const trailing = group.isComplete
          ? formatDuration(group.totalDurationMs)
          : isFanout && group.succeededCount > 0
            ? `${group.succeededCount}/${group.invocationCount}`
            : "running";

        return (
          <li key={group.step} className="animate-fade-up relative">
            <button
              type="button"
              onClick={hasDetails ? () => toggle(group.step) : undefined}
              disabled={!hasDetails}
              aria-expanded={hasDetails ? isExpanded : undefined}
              className={cn(
                "group flex w-full items-center gap-3 rounded-lg py-1.5 pl-0 pr-2 text-left transition-colors",
                hasDetails && "hover:bg-secondary/50 cursor-pointer",
                !hasDetails && "cursor-default",
              )}
            >
              <span
                className={cn(
                  "relative z-10 flex size-[22px] shrink-0 items-center justify-center rounded-full border",
                  statusRingClass(group.finalStatus),
                )}
              >
                {isActive && (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-0 animate-pulse-ring rounded-full",
                      group.finalStatus === "retrying" ? "bg-accent/40" : "bg-primary/40",
                    )}
                  />
                )}
                <StatusIcon status={group.finalStatus} />
              </span>

              <span className="flex flex-1 items-center gap-2 text-[13.5px]">
                <span className="text-foreground font-medium">{label}</span>
                {isFanout && (
                  <span className="bg-secondary/80 text-muted-foreground border-border/60 rounded-full border px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.18em]">
                    × {group.invocationCount}
                  </span>
                )}
                {group.retryCount > 0 && (
                  <span className="text-accent font-mono text-[10px] uppercase tracking-[0.18em]">
                    +{group.retryCount} retry
                  </span>
                )}
              </span>

              <span className="text-muted-foreground/70 font-num font-mono text-[10.5px] tabular-nums">
                {trailing}
              </span>
              {hasDetails && (
                <ChevronRight
                  aria-hidden
                  className={cn(
                    "text-muted-foreground/50 group-hover:text-muted-foreground size-3.5 shrink-0 transition-transform duration-200",
                    isExpanded && "rotate-90",
                  )}
                  strokeWidth={2}
                />
              )}
            </button>

            {isExpanded && hasDetails && (
              <div className="animate-fade-in border-border/60 bg-secondary/40 ml-8 mr-1 mt-1.5 mb-2 space-y-2.5 rounded-lg border p-3">
                {description && (
                  <p className="text-foreground/75 text-[12.5px] leading-relaxed">{description}</p>
                )}
                {payloadEntries.length > 0 && (
                  <dl className="grid gap-1 text-[11.5px]">
                    {payloadEntries.map(({ key, value }) => (
                      <div key={key} className="flex flex-wrap gap-x-2 font-mono">
                        <dt className="text-muted-foreground/80">{key}:</dt>
                        <dd className="text-foreground/85 break-all">{value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {isFanout && (
                  <p className="text-muted-foreground/70 border-border/60 border-t pt-2 font-mono text-[10.5px] uppercase tracking-[0.18em]">
                    {group.succeededCount} of {group.invocationCount} succeeded
                    {group.failedCount > 0 && ` · ${group.failedCount} failed`}
                    {group.retryCount > 0 && ` · ${group.retryCount} retried`}
                  </p>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
