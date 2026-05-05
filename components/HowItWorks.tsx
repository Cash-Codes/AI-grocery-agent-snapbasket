import { Camera, Sparkles, ShieldCheck } from "lucide-react";

const STEPS = [
  {
    n: 1,
    icon: Camera,
    title: "Snap your list",
    body: "Upload a photo or use the bundled sample. We hash, dedup and store it. Same image twice never produces a duplicate run.",
  },
  {
    n: 2,
    icon: Sparkles,
    title: "We extract & match",
    body: "Vision provider transcribes, the parser normalizes, matchProducts fan outs to a UCP inspired commerce provider with concurrency limits and per task retries.",
  },
  {
    n: 3,
    icon: ShieldCheck,
    title: "You approve, we finalize",
    body: "Policy validation runs (budget, allergens, dietary, low confidence matches). The workflow pauses durably for your approval. One click and it resumes.",
  },
];

export function HowItWorks() {
  return (
    <section className="space-y-10">
      <div className="animate-fade-up space-y-3" style={{ ["--stagger" as string]: "0ms" }}>
        <p className="text-muted-foreground/80 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em]">
          <span aria-hidden className="bg-primary/40 inline-block h-px w-5" />
          Three movements
        </p>
        <h2 className="text-foreground text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
          How this works
        </h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <div
              key={step.n}
              className="animate-fade-up ring-frost border-border bg-card hover:border-primary/30 group relative flex flex-col gap-4 rounded-2xl border p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-12px_oklch(0.55_0.165_153/0.18)]"
              style={{ ["--stagger" as string]: `${100 + i * 80}ms` }}
            >
              <div className="flex items-center justify-between">
                <div className="bg-primary/10 ring-primary/20 flex size-9 items-center justify-center rounded-lg ring-1">
                  <Icon className="text-primary size-4" strokeWidth={1.75} />
                </div>
                <span className="text-muted-foreground/60 font-mono text-[10px] uppercase tracking-[0.2em]">
                  Step {step.n}
                </span>
              </div>
              <div className="space-y-2">
                <h3 className="text-foreground text-[15px] font-semibold tracking-tight">
                  {step.title}
                </h3>
                <p className="text-muted-foreground text-[13px] leading-relaxed">{step.body}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
