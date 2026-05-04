import type { RunStatus } from "@/lib/domain/types";
import { RUN_STATUS_COLOR } from "@/lib/ui/status-color";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, className }: { status: RunStatus; className?: string }) {
  const colorClasses = RUN_STATUS_COLOR[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide",
        colorClasses,
        className,
      )}
    >
      {status.replace(/_/g, " ").toLowerCase()}
    </span>
  );
}
