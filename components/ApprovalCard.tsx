"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";

import { PolicyFlagList } from "@/components/PolicyFlagList";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { PolicyFlag } from "@/lib/domain/types";

interface ApprovalCardProps {
  runId: string;
  flags: PolicyFlag[];
  requiresExplicitApproval: boolean;
  onApproved: () => void;
}

export function ApprovalCard({
  runId,
  flags,
  requiresExplicitApproval,
  onApproved,
}: ApprovalCardProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(approved: boolean) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/runs/${runId}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          approved,
          decidedBy: "user_default",
          reason: reason.trim().length > 0 ? reason.trim() : null,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(body?.error?.message ?? `Status ${res.status}`);
      }
      onApproved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setSubmitting(false);
    }
  }

  return (
    <section className="ring-frost border-accent/40 bg-accent/[0.04] animate-fade-up relative overflow-hidden rounded-2xl border p-6">
      {/* ambient glow */}
      <span
        aria-hidden
        className="bg-accent/20 pointer-events-none absolute -top-24 -right-24 size-64 rounded-full blur-3xl"
      />
      <div className="relative space-y-5">
        <div className="space-y-2">
          <p className="text-accent inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.22em]">
            <span aria-hidden className="relative inline-flex size-1.5">
              <span className="bg-accent absolute inset-0 animate-pulse-ring rounded-full" />
              <span className="bg-accent relative inline-flex size-1.5 rounded-full" />
            </span>
            Awaiting your approval
          </p>
          <h2 className="text-foreground text-2xl font-semibold tracking-[-0.015em]">
            Approve this basket?
          </h2>
          {requiresExplicitApproval && flags.length > 0 ? (
            <p className="text-muted-foreground text-[13.5px]">
              The proposed basket has flags worth a closer look
            </p>
          ) : (
            <p className="text-muted-foreground text-[13.5px]">
              No policy issues detected. Approval is required to finalize the mock checkout.
            </p>
          )}
        </div>

        {flags.length > 0 && <PolicyFlagList flags={flags} />}

        <div className="space-y-2">
          <label
            htmlFor="reason"
            className="text-muted-foreground/80 block font-mono text-[10.5px] uppercase tracking-[0.2em]"
          >
            Reason (optional)
          </label>
          <Textarea
            id="reason"
            placeholder="E.g. 'OK for this week', 'Reject - over budget', etc."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={submitting}
            rows={2}
            className="bg-secondary/60 border-border/70 focus-visible:border-primary/40 focus-visible:ring-primary/20 rounded-xl"
          />
        </div>

        {error && <p className="text-destructive text-sm">Couldn&apos;t submit: {error}</p>}

        <div className="flex gap-2">
          <Button
            onClick={() => void submit(true)}
            disabled={submitting}
            className="bg-primary text-primary-foreground hover:bg-primary/90 h-11 flex-1 rounded-xl text-sm font-semibold shadow-[0_10px_24px_-8px_oklch(0.55_0.165_153/0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-8px_oklch(0.55_0.165_153/0.55)]"
          >
            <Check className="mr-1.5 size-4" strokeWidth={2.25} />
            {submitting ? "Submitting..." : "Approve"}
          </Button>
          <Button
            variant="outline"
            onClick={() => void submit(false)}
            disabled={submitting}
            className="border-border/70 hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive h-11 flex-1 rounded-xl text-sm font-medium transition-colors"
          >
            <X className="mr-1.5 size-4" strokeWidth={2.25} />
            Reject
          </Button>
        </div>
      </div>
    </section>
  );
}
