import { RunDemoButton } from "./RunDemoButton";

export function Hero() {
  return (
    <section className="space-y-6">
      <p className="text-xs uppercase tracking-widest text-zinc-500">Durable AI grocery agent</p>
      <h1 className="font-serif text-5xl tracking-tight text-zinc-900 sm:text-6xl">SnapBasket</h1>
      <p className="max-w-2xl text-lg leading-relaxed text-zinc-600">
        Upload a photo of a handwritten grocery list. We extract the items, match them to a
        catalogue, validate against your preferences and pause for your approval before finalizing.
        Built on durable workflow orchestration so retries, pauses and partial failures don&apos;t
        break the experience.
      </p>
      <div className="pt-2">
        <RunDemoButton />
      </div>
    </section>
  );
}
