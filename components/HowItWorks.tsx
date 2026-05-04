import { Card, CardContent } from "@/components/ui/card";

const STEPS = [
  {
    n: 1,
    title: "Snap your list",
    body: "Upload a photo or use the bundled sample. We hash, dedup, and store it. Same image twice never produces a duplicate run.",
  },
  {
    n: 2,
    title: "We extract & match",
    body: "Vision provider transcribes; the parser normalizes; matchProducts fan-outs to a UCP-inspired commerce provider with concurrency limits and per-task retries.",
  },
  {
    n: 3,
    title: "You approve, we finalize",
    body: "Policy validation runs (budget, allergens, dietary, low-confidence matches). The workflow pauses durably for your approval. One click and it resumes.",
  },
];

export function HowItWorks() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">How this works</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((step) => (
          <Card key={step.n} className="border-zinc-200">
            <CardContent className="space-y-3 p-6">
              <p className="text-xs uppercase tracking-widest text-primary">Step {step.n}</p>
              <h3 className="text-lg font-medium">{step.title}</h3>
              <p className="text-sm leading-relaxed text-zinc-600">{step.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
