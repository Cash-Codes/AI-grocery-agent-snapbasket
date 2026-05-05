"use client";

import { ApprovalCard } from "@/components/ApprovalCard";
import { BasketReview } from "@/components/BasketReview";
import { IntentList } from "@/components/IntentList";
import { ReceiptCard } from "@/components/ReceiptCard";
import { RunImagePreview } from "@/components/RunImagePreview";
import { RunProgress } from "@/components/RunProgress";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
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
        <p className="text-destructive text-sm">Couldn&apos;t load run: {error.message}</p>
        <Button
          variant="outline"
          onClick={() => void refetch()}
          className="border-border/70 hover:border-primary/40 hover:bg-primary/10 rounded-xl"
        >
          Retry
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="bg-secondary/60 h-9 w-48 rounded-xl" />
        <Skeleton className="bg-secondary/60 h-32 w-full rounded-2xl" />
        <Skeleton className="bg-secondary/60 h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const status = data.run.status as RunStatus;

  return (
    <div className="space-y-8">
      <header className="animate-fade-up space-y-3" style={{ ["--stagger" as string]: "0ms" }}>
        <p className="text-muted-foreground/80 inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.22em]">
          <span aria-hidden className="bg-primary/40 inline-block h-px w-5" />
          Run detail
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-foreground text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
            Run
          </h1>
          <StatusBadge status={status} />
        </div>
        <p className="text-muted-foreground/70 break-all font-mono text-[11px]">
          {data.run.id} · {data.run.correlationId}
        </p>
      </header>

      <RunProgress events={data.events as WorkflowEventRow[]} status={status} />

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start lg:gap-8">
        {/* Left rail - sticky on lg, stacks above on mobile */}
        <aside
          className="animate-fade-up lg:sticky lg:top-16 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto"
          style={{ ["--stagger" as string]: "80ms" }}
        >
          <section className="ring-frost border-border bg-card rounded-2xl border p-5">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-muted-foreground/80 font-mono text-[10.5px] uppercase tracking-[0.22em]">
                Workflow timeline
              </h2>
            </div>
            <WorkflowTimeline events={data.events as WorkflowEventRow[]} />
          </section>
        </aside>

        {/* Main column - source image + items + basket + decision */}
        <div className="space-y-6">
          {data.intents.length > 0 && <RunImagePreview imageId={data.run.imageId} />}

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
            <div className="ring-frost border-border bg-card animate-fade-up rounded-2xl border p-6">
              <p className="text-foreground/80 text-sm">Run rejected. No checkout finalized.</p>
            </div>
          )}

          {status === "TIMED_OUT" && (
            <div className="ring-frost border-border bg-card animate-fade-up rounded-2xl border p-6">
              <p className="text-foreground/80 text-sm">
                Approval timed out (24h elapsed). Run ended.
              </p>
            </div>
          )}

          {status === "FAILED" && (
            <div className="ring-frost border-destructive/40 bg-destructive/[0.05] animate-fade-up space-y-2 rounded-2xl border p-6">
              <p className="text-destructive inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.22em]">
                <span aria-hidden className="bg-destructive inline-block size-1.5 rounded-full" />
                Workflow failed
              </p>
              {data.run.failureStep && (
                <p className="text-foreground/80 text-sm">
                  Failed at step:{" "}
                  <code className="bg-secondary border-border/60 rounded-md border px-1.5 py-0.5 font-mono text-xs">
                    {data.run.failureStep}
                  </code>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
