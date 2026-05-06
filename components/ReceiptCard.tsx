import { Check } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { formatPence } from "@/lib/ui/format";

export interface ReceiptCardProps {
  totalPence: number;
  sessionId: string | null;
}

export function ReceiptCard({ totalPence, sessionId }: ReceiptCardProps) {
  return (
    <section className="ring-frost border-primary/30 bg-primary/[0.05] animate-fade-up relative overflow-hidden rounded-2xl border p-6">
      <span
        aria-hidden
        className="bg-primary/15 pointer-events-none absolute -top-24 -right-16 size-64 rounded-full blur-3xl"
      />

      <div className="relative space-y-5">
        <div className="flex items-start gap-4">
          <span className="bg-primary/15 ring-primary/30 flex size-10 items-center justify-center rounded-xl ring-1">
            <Check className="text-primary size-4" strokeWidth={2.5} />
          </span>
          <div className="space-y-1">
            <p className="text-primary inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.22em]">
              <span aria-hidden className="bg-primary inline-block size-1.5 rounded-full" />
              Run complete
            </p>
            <h2 className="text-foreground text-2xl font-semibold tracking-[-0.015em]">
              Mock checkout completed
            </h2>
            <p className="text-muted-foreground text-[12.5px]">No real payment processed</p>
          </div>
        </div>

        <dl className="border-border/60 grid gap-2.5 border-t pt-4 text-[13.5px]">
          <div className="flex items-baseline justify-between">
            <dt className="text-muted-foreground/80 font-mono text-[10.5px] uppercase tracking-[0.18em]">
              Mock total
            </dt>
            <dd className="text-foreground font-num font-mono text-base font-semibold tabular-nums">
              {formatPence(totalPence)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground/80 font-mono text-[10.5px] uppercase tracking-[0.18em]">
              Mock checkout reference
            </dt>
            <dd className="text-foreground/80 max-w-[18ch] truncate font-mono text-[11px]">
              {sessionId ?? "(pending)"}
            </dd>
          </div>
        </dl>

        <Button
          asChild
          variant="outline"
          className="border-border/70 hover:border-primary/40 hover:bg-primary/10 group h-11 w-full rounded-xl text-sm font-medium transition-colors"
        >
          <Link href="/">
            <span className="inline-flex items-center gap-2">
              Run another
              <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </span>
          </Link>
        </Button>
      </div>
    </section>
  );
}
