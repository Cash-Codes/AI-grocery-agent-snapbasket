export function WhyThisExists() {
  return (
    <section className="space-y-10">
      <div className="animate-fade-up space-y-3" style={{ ["--stagger" as string]: "0ms" }}>
        <p className="text-muted-foreground/80 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em]">
          <span aria-hidden className="bg-accent/50 inline-block h-px w-5" />
          Long-form
        </p>
        <h2 className="text-foreground text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
          Why this exists
        </h2>
      </div>

      <div
        className="animate-fade-up text-foreground/80 max-w-2xl space-y-6 text-[15px] leading-[1.75]"
        style={{ ["--stagger" as string]: "120ms" }}
      >
        <p>
          The interesting part of an agentic AI workflow is rarely the LLM call itself. It is
          everything around it - durable retries, idempotency, human approval, structured failure
          handling, provider abstraction and a clear safety boundary between &quot;the agent
          proposes&quot; and &quot;the user confirms.&quot;
        </p>
        <p>This project explores Trigger.dev as the orchestration layer for that workflow.</p>
        <p>
          Each workflow run is persisted step by step, so if the server restarts, a retry fails, or
          a user takes hours to approve an action, the run can resume from the correct point. Per
          task retries use deterministic idempotency keys, while{" "}
          <code className="bg-secondary border-border/60 text-foreground/90 rounded-md border px-1.5 py-0.5 font-mono text-[12.5px]">
            matchProducts
          </code>{" "}
          uses queue managed concurrency to fan out work without overwhelming downstream providers.
          The human approval step is modelled as a real waitpoint rather than a polling workaround.
        </p>
        <p>
          The vision and commerce integrations sit behind provider interfaces. The default vision
          provider returns deterministic mock transcriptions, while an optional OpenAI
          implementation can be enabled via env config. The mock commerce provider mirrors a UCP
          style flow - search, basket, checkout and order status, intentionally keeping real
          retailer integration out of scope.
        </p>
        <p>
          The goal is not to build a shopping demo. The goal is to show how an AI assisted workflow
          can be made durable, inspectable and safe enough to run in production.
        </p>
      </div>
    </section>
  );
}
