import type { RunStatus } from "@/lib/domain/types";
import { RUN_STATUS_COLOR } from "@/lib/ui/status-color";
import { cn } from "@/lib/utils";

const PULSING_STATUSES: RunStatus[] = ["RUNNING", "AWAITING_APPROVAL"];

export function StatusBadge({ status, className }: { status: RunStatus; className?: string }) {
  const colorClasses = RUN_STATUS_COLOR[status];
  const isPulsing = PULSING_STATUSES.includes(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-2.5 py-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.14em]",
        colorClasses,
        className,
      )}
    >
      <span aria-hidden className="relative inline-flex size-1.5">
        {isPulsing && (
          <span className="bg-current absolute inset-0 animate-pulse-ring rounded-full opacity-60" />
        )}
        <span
          className={cn(
            "bg-current relative inline-flex size-1.5 rounded-full",
            isPulsing && "animate-pulse-soft",
          )}
        />
      </span>
      {status.replace(/_/g, " ").toLowerCase()}
    </span>
  );
}
