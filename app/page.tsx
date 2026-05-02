export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 p-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-zinc-500">
          Phase 0 - baseline scaffold
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">SnapBasket</h1>
        <p className="text-zinc-600">
          A durable AI grocery agent. Upload a grocery list photo, get a basket
          back, approve before checkout.
        </p>
      </header>
      <section className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
        The full UI lands in Phase 7. Until then, this is a placeholder so the
        scaffold can be verified end-to-end.
      </section>
    </main>
  );
}
