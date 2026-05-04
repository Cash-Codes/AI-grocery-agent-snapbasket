export function WhyThisExists() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold tracking-tight">Why this exists</h2>
      <div className="space-y-4 leading-relaxed text-zinc-700">
        <p>
          The interesting layer of an agentic AI workflow isn&apos;t the LLM call. It&apos;s
          everything around it — durable retries, idempotency, durable pauses for human input,
          structured failure handling, provider abstraction, and a clear safety boundary between
          &quot;the agent proposes&quot; and &quot;the user confirms.&quot;
        </p>
        <p>
          This project uses Trigger.dev v4 as the orchestration substrate. Workflow runs are
          persisted at every step — if the server restarts, retries fail, or a user takes hours to
          approve, the run resumes where it paused. Per-task retries use deterministic idempotency
          keys; <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm">matchProducts</code>{" "}
          uses queue-managed concurrency to fan out without saturating the downstream provider; the
          human approval step is a real waitpoint, not a polling hack.
        </p>
        <p>
          The vision and commerce providers sit behind interfaces. The default mock vision provider
          returns deterministic transcriptions; the optional OpenAI implementation plugs in via env
          var. The mock commerce provider mirrors a UCP-style API — search, basket, checkout, order
          status — keeping real retailer integration out of scope on purpose.
        </p>
      </div>
    </section>
  );
}
