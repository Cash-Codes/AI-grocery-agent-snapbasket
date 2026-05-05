export function DemoBanner() {
  return (
    <div className="border-border/50 bg-background/60 sticky top-0 z-50 border-b backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-2 text-center text-[11px] sm:gap-3">
        <span className="text-primary inline-flex items-center gap-1.5 font-mono uppercase tracking-[0.2em]">
          <span aria-hidden className="relative inline-flex size-1.5">
            <span className="bg-primary absolute inset-0 animate-pulse-ring rounded-full" />
            <span className="bg-primary relative inline-flex size-1.5 rounded-full" />
          </span>
          Demo mode
        </span>
        <span className="bg-border/60 hidden h-3 w-px sm:inline-block" />
        <span className="text-muted-foreground hidden sm:inline">
          No real payment, no real retailer, mock providers throughout
        </span>
      </div>
    </div>
  );
}
