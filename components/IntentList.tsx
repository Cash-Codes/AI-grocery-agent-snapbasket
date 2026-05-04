import { Card, CardContent } from "@/components/ui/card";

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
    <Card className="border-zinc-200">
      <CardContent className="space-y-4 p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            Items detected
          </h2>
          <span className="text-xs text-zinc-500">
            {intents.length} item{intents.length === 1 ? "" : "s"}
            {needsClarification > 0 && ` · ${needsClarification} need clarification`}
          </span>
        </div>
        <ul className="divide-y divide-zinc-200">
          {intents.map((intent) => {
            const candidates = candidatesByIntent[intent.id] ?? [];
            const top = candidates.find((c) => c.isSelected) ?? candidates[0];
            return (
              <li key={intent.id} className="flex items-baseline justify-between py-3">
                <div className="space-y-1">
                  <p className="text-sm">
                    <span className="font-medium">{intent.canonicalName}</span>
                    {intent.quantity !== 1 && (
                      <span className="ml-2 text-xs text-zinc-500">
                        × {intent.quantity} {intent.unit}
                      </span>
                    )}
                    {intent.needsClarification && (
                      <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
                        clarify
                      </span>
                    )}
                  </p>
                  {top && <p className="text-xs text-zinc-500">{top.name}</p>}
                </div>
                {top && (
                  <span className="font-mono text-xs tabular-nums text-zinc-600">
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
      </CardContent>
    </Card>
  );
}
