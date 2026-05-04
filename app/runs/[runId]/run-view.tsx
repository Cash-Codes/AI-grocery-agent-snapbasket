"use client";

import { ApprovalCard } from "@/components/ApprovalCard";
import { BasketReview } from "@/components/BasketReview";
import { IntentList } from "@/components/IntentList";
import { ReceiptCard } from "@/components/ReceiptCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkflowTimeline } from "@/components/WorkflowTimeline";
import type { WorkflowEventRow } from "@/lib/db/schema";
import type { PolicyFlag, RunStatus } from "@/lib/domain/types";
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

      {data.intents.length > 0 && (
        <IntentList
          intents={data.intents as never}
          candidatesByIntent={data.candidatesByIntent as never}
        />
      )}

      {Boolean(data.basket) && (
        <BasketReview
          basket={data.basket as never}
          items={data.items as never}
          candidatesByIntent={data.candidatesByIntent as never}
          policy={data.policy as never}
        />
      )}

      {status === "AWAITING_APPROVAL" && Boolean(data.basket) && Boolean(data.policy) && (
        <ApprovalCard
          runId={runId}
          flags={JSON.parse((data.policy as { flagsJson: string }).flagsJson) as PolicyFlag[]}
          requiresExplicitApproval={
            (data.policy as { requiresExplicitApproval: boolean }).requiresExplicitApproval
          }
          onApproved={() => void refetch()}
        />
      )}

      {status === "COMPLETED" && Boolean(data.basket) && (
        <ReceiptCard
          totalPence={(data.basket as { totalPence: number }).totalPence}
          sessionId={
            (data.checkoutSession as { providerSessionId: string } | null)?.providerSessionId ??
            null
          }
        />
      )}

      {status === "REJECTED" && (
        <Card className="border-zinc-300 bg-zinc-50">
          <CardContent className="p-6">
            <p className="text-sm text-zinc-700">Run rejected. No checkout finalized.</p>
          </CardContent>
        </Card>
      )}

      {status === "TIMED_OUT" && (
        <Card className="border-zinc-300 bg-zinc-50">
          <CardContent className="p-6">
            <p className="text-sm text-zinc-700">Approval timed out (24h elapsed). Run ended.</p>
          </CardContent>
        </Card>
      )}

      {status === "FAILED" && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="space-y-2 p-6">
            <p className="text-sm font-medium text-red-700">Workflow failed.</p>
            {data.run.failureStep && (
              <p className="text-sm text-zinc-700">
                Failed at step:{" "}
                <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">
                  {data.run.failureStep}
                </code>
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
