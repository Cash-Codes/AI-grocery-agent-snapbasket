interface Intent {
  id: string;
  originalText: string;
  canonicalName: string;
  quantity: number;
  unit: string;
  category: string;
  confidence: number;
  needsClarification: boolean;
  clarificationReason: string | null;
}

interface Candidate {
  id: string;
  intentId: string;
  name: string;
  pricePence: number;
  unit: string;
  score: number;
  isSelected: boolean;
}

export function IntentList({
  intents,
  candidatesByIntent,
}: {
  intents: Intent[];
  candidatesByIntent: Record<string, Candidate[]>;
}) {
  if (intents.length === 0) return null;

  const needsClarification = intents.filter((i) => i.needsClarification).length;

  return (
    <section className="ring-frost border-border bg-card animate-fade-up rounded-2xl border p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-muted-foreground/80 font-mono text-[10.5px] uppercase tracking-[0.22em]">
          Items detected
        </h2>
        <span className="text-muted-foreground/60 font-mono text-[10.5px] tabular-nums">
          {intents.length} item{intents.length === 1 ? "" : "s"}
          {needsClarification > 0 && ` · ${needsClarification} need clarification`}
        </span>
      </div>
      <ul className="divide-border/60 divide-y">
        {intents.map((intent) => {
          const candidates = candidatesByIntent[intent.id] ?? [];
          const top = candidates.find((c) => c.isSelected) ?? candidates[0];
          return (
            <li
              key={intent.id}
              className="flex items-baseline justify-between py-3 first:pt-0 last:pb-0"
            >
              <div className="space-y-1">
                <p className="text-[14px]">
                  <span className="text-foreground font-medium">{intent.canonicalName}</span>
                  {intent.quantity !== 1 && (
                    <span className="text-muted-foreground/70 ml-2 font-mono text-[11px]">
                      × {intent.quantity} {intent.unit}
                    </span>
                  )}
                  {intent.needsClarification && (
                    <span className="bg-accent/15 text-accent ring-accent/30 ml-2 rounded-md px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.18em] ring-1">
                      clarify
                    </span>
                  )}
                </p>
                {top && <p className="text-muted-foreground text-[12px]">{top.name}</p>}
              </div>
              {top && (
                <span className="text-foreground/85 font-num font-mono text-[12px] tabular-nums">
                  {(top.pricePence / 100).toLocaleString("en-GB", {
                    style: "currency",
                    currency: "GBP",
                  })}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
