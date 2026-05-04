"use client";

import { useState } from "react";

import { PolicyFlagList } from "@/components/PolicyFlagList";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    <Card className="border-amber-300 bg-amber-50/50">
      <CardContent className="space-y-5 p-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-amber-700">Awaiting your approval</p>
          <h2 className="text-xl font-semibold tracking-tight">Approve this basket?</h2>
          {requiresExplicitApproval && flags.length > 0 ? (
            <p className="text-sm text-zinc-700">
              The proposed basket has flags worth a closer look:
            </p>
          ) : (
            <p className="text-sm text-zinc-700">
              No policy issues detected. Approval is required to finalize the mock checkout.
            </p>
          )}
        </div>

        {flags.length > 0 && <PolicyFlagList flags={flags} />}

        <div className="space-y-2">
          <label
            htmlFor="reason"
            className="text-xs font-medium uppercase tracking-wide text-zinc-500"
          >
            Reason (optional)
          </label>
          <Textarea
            id="reason"
            placeholder="E.g. 'OK for this week', 'Reject — over budget', etc."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={submitting}
            rows={2}
          />
        </div>

        {error && <p className="text-sm text-red-600">Couldn&apos;t submit: {error}</p>}

        <div className="flex gap-3">
          <Button onClick={() => void submit(true)} disabled={submitting} className="flex-1">
            {submitting ? "Submitting..." : "Approve"}
          </Button>
          <Button
            variant="outline"
            onClick={() => void submit(false)}
            disabled={submitting}
            className="flex-1"
          >
            Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
