import { PolicyFlagList } from "@/components/PolicyFlagList";
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
  const candidateMap = new Map<string, Candidate>();
  for (const list of Object.values(candidatesByIntent)) {
    for (const c of list) candidateMap.set(c.id, c);
  }

  const flags: PolicyFlag[] = policy ? (JSON.parse(policy.flagsJson) as PolicyFlag[]) : [];

  return (
    <section className="ring-frost border-border bg-card animate-fade-up space-y-5 rounded-2xl border p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-muted-foreground/80 font-mono text-[10.5px] uppercase tracking-[0.22em]">
          Proposed basket
        </h2>
        <span className="text-foreground font-num font-mono text-xl font-semibold tabular-nums">
          {formatPence(basket.totalPence)}
        </span>
      </div>

      <ul className="divide-border/60 divide-y">
        {items.map((item) => {
          const candidate = candidateMap.get(item.candidateId);
          return (
            <li
              key={item.id}
              className="flex items-baseline justify-between py-2.5 first:pt-0 last:pb-0"
            >
              <div>
                <p className="text-foreground/90 text-[14px]">
                  {candidate?.name ?? "Unknown product"}
                </p>
                {item.quantity !== 1 && (
                  <p className="text-muted-foreground/70 font-mono text-[11px]">
                    × {item.quantity}
                  </p>
                )}
              </div>
              <span className="text-foreground/80 font-num font-mono text-[12px] tabular-nums">
                {formatPence(item.linePricePence)}
              </span>
            </li>
          );
        })}
      </ul>

      {flags.length > 0 && (
        <div className="border-border/60 space-y-3 border-t pt-4">
          <p className="text-muted-foreground/80 font-mono text-[10.5px] uppercase tracking-[0.22em]">
            Policy flags
          </p>
          <PolicyFlagList flags={flags} />
        </div>
      )}
    </section>
  );
}
