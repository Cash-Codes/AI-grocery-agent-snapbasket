import { RunDemoButton } from "./RunDemoButton";
import { UploadCard } from "./UploadCard";

export function Hero() {
  return (
    <section className="relative">
      <div className="space-y-7">
        <div
          className="animate-fade-up inline-flex items-center gap-2.5"
          style={{ ["--stagger" as string]: "0ms" }}
        >
          <span className="bg-primary/10 ring-primary/20 relative inline-flex size-1.5 items-center justify-center rounded-full ring-4">
            <span className="bg-primary absolute inset-0 animate-pulse-soft rounded-full" />
          </span>
          <span className="text-muted-foreground font-mono text-[11px] uppercase tracking-[0.22em]">
            AI grocery agent
          </span>
        </div>

        <h1
          className="animate-fade-up text-foreground text-balance text-[3.25rem] font-semibold leading-[1.02] tracking-[-0.04em] sm:text-[5rem]"
          style={{ ["--stagger" as string]: "80ms" }}
        >
          SnapBasket
        </h1>

        <p
          className="animate-fade-up text-muted-foreground max-w-xl text-balance text-[15px] leading-[1.7] sm:text-base"
          style={{ ["--stagger" as string]: "160ms" }}
        >
          Upload a photo of a handwritten grocery list. We extract the items, match them to a
          catalogue, validate against your preferences and pause for your approval before
          finalizing. Built on durable workflow orchestration so retries, pauses and partial
          failures don&apos;t break the experience.
        </p>
      </div>

      <div className="animate-fade-up mt-12 space-y-4" style={{ ["--stagger" as string]: "260ms" }}>
        <p className="text-muted-foreground/80 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em]">
          <span aria-hidden className="bg-primary/40 inline-block h-px w-5" />
          No account or real checkout · mock mode only
        </p>

        <UploadCard />

        <div className="flex items-center gap-4 pt-1">
          <span className="bg-border/70 h-px flex-1" />
          <span className="text-muted-foreground/70 font-mono text-[10px] uppercase tracking-[0.22em]">
            or
          </span>
          <span className="bg-border/70 h-px flex-1" />
        </div>

        <div className="space-y-2.5">
          <p className="text-muted-foreground text-[13.5px]">
            No grocery photo handy? Try the demo.
          </p>
          <RunDemoButton />
        </div>
      </div>
    </section>
  );
}
