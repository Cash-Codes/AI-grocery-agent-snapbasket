import { Check } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatPence } from "@/lib/ui/format";

export interface ReceiptCardProps {
  totalPence: number;
  sessionId: string | null;
}

export function ReceiptCard({ totalPence, sessionId }: ReceiptCardProps) {
  return (
    <Card className="border-emerald-300 bg-emerald-50/50">
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-emerald-100">
            <Check className="size-5 text-emerald-700" />
          </span>
          <div>
            <p className="text-xs uppercase tracking-widest text-emerald-700">Run complete</p>
            <h2 className="text-xl font-semibold tracking-tight">Mock checkout completed</h2>
            <p className="text-xs text-emerald-700">No real payment processed</p>
          </div>
        </div>
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-zinc-500">Mock total</dt>
            <dd className="font-mono font-semibold tabular-nums">{formatPence(totalPence)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">Mock checkout reference</dt>
            <dd className="font-mono text-xs">{sessionId ?? "(pending)"}</dd>
          </div>
        </dl>
        <Button asChild variant="outline" className="w-full">
          <Link href="/">Run another</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
