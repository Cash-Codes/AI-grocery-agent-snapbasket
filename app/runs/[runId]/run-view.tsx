"use client";

import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkflowTimeline } from "@/components/WorkflowTimeline";
import type { WorkflowEventRow } from "@/lib/db/schema";
import type { RunStatus } from "@/lib/domain/types";
import { usePollRun } from "@/lib/ui/use-poll-run";

export function RunView({ runId }: { runId: string }) {
  const { data, error, refetch } = usePollRun(runId);

  if (error && !data) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-600">Couldn&apos;t load run: {error.message}</p>
        <Button variant="outline" onClick={() => void refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const status = data.run.status as RunStatus;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Run</h1>
          <StatusBadge status={status} />
        </div>
        <p className="break-all font-mono text-xs text-zinc-500">
          {data.run.id} · {data.run.correlationId}
        </p>
      </header>

      <Card className="border-zinc-200">
        <CardContent className="space-y-4 p-6">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            Workflow timeline
          </h2>
          <WorkflowTimeline events={data.events as WorkflowEventRow[]} />
        </CardContent>
      </Card>
    </div>
  );
}
