import { PolicyFlagList } from "@/components/PolicyFlagList";
import { Card, CardContent } from "@/components/ui/card";
import type { PolicyFlag } from "@/lib/domain/types";
import { formatPence } from "@/lib/ui/format";

interface Basket {
  id: string;
  totalPence: number;
  itemCount: number;
}

interface Item {
  id: string;
  basketId: string;
  candidateId: string;
  quantity: number;
  linePricePence: number;
}

interface Candidate {
  id: string;
  name: string;
  pricePence: number;
  unit: string;
}

interface PolicyResult {
  ok: boolean;
  totalCostPence: number;
  flagsJson: string;
  requiresExplicitApproval: boolean;
}

export interface BasketReviewProps {
  basket: Basket;
  items: Item[];
  candidatesByIntent: Record<string, Candidate[]>;
  policy: PolicyResult | null;
}

export function BasketReview({ basket, items, candidatesByIntent, policy }: BasketReviewProps) {
  // Flatten candidatesByIntent into a single lookup map.
  const candidateMap = new Map<string, Candidate>();
  for (const list of Object.values(candidatesByIntent)) {
    for (const c of list) candidateMap.set(c.id, c);
  }

  const flags: PolicyFlag[] = policy ? (JSON.parse(policy.flagsJson) as PolicyFlag[]) : [];

  return (
    <Card className="border-zinc-200">
      <CardContent className="space-y-5 p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            Proposed basket
          </h2>
          <span className="font-mono text-lg font-semibold tabular-nums">
            {formatPence(basket.totalPence)}
          </span>
        </div>

        <ul className="divide-y divide-zinc-200">
          {items.map((item) => {
            const candidate = candidateMap.get(item.candidateId);
            return (
              <li key={item.id} className="flex items-baseline justify-between py-2">
                <div>
                  <p className="text-sm">{candidate?.name ?? "Unknown product"}</p>
                  {item.quantity !== 1 && (
                    <p className="text-xs text-zinc-500">× {item.quantity}</p>
                  )}
                </div>
                <span className="font-mono text-xs tabular-nums">
                  {formatPence(item.linePricePence)}
                </span>
              </li>
            );
          })}
        </ul>

        {flags.length > 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-xs uppercase tracking-widest text-zinc-500">Policy flags</p>
            <PolicyFlagList flags={flags} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
