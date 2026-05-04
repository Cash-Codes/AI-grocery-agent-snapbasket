import { Check, CircleDashed, RotateCw, X } from "lucide-react";

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

function StatusIcon({ status }: { status: EventStatus }) {
  switch (status) {
    case "started":
      return <CircleDashed className={cn("size-4 text-zinc-400 animate-pulse")} />;
    case "succeeded":
      return <Check className="size-4 text-emerald-600" />;
    case "failed":
      return <X className="size-4 text-red-600" />;
    case "retrying":
      return <RotateCw className="size-4 text-amber-600 animate-spin" />;
  }
}

export interface WorkflowTimelineProps {
  events: WorkflowEventRow[];
}

export function WorkflowTimeline({ events }: WorkflowTimelineProps) {
  const sortedEvents = [...events].sort((a, b) => {
    const aTs =
      a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
    const bTs =
      b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
    return aTs - bTs;
  });

  if (sortedEvents.length === 0) {
    return <p className="text-sm italic text-zinc-500">Waiting for the first event…</p>;
  }

  return (
    <ol className="space-y-3">
      {sortedEvents.map((event, idx) => {
        const prev = idx > 0 ? sortedEvents[idx - 1] : null;
        const elapsedMs = prev
          ? new Date(event.timestamp).getTime() - new Date(prev.timestamp).getTime()
          : 0;
        const label = STEP_LABELS[event.step] ?? event.step;
        return (
          <li
            key={event.id}
            className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-2"
          >
            <StatusIcon status={event.status} />
            <span className="flex-1 text-sm">
              <span className="font-medium">{label}</span>
              {event.attempt > 1 && (
                <span className="ml-2 text-xs text-amber-600">attempt {event.attempt}</span>
              )}
            </span>
            <span className="text-xs tabular-nums text-zinc-400">
              {idx > 0 ? `+${formatDuration(elapsedMs)}` : "start"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
