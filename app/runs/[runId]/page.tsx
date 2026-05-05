import { RunView } from "./run-view";

interface PageProps {
  params: Promise<{ runId: string }>;
}

export default async function RunPage({ params }: PageProps) {
  const { runId } = await params;
  return (
    <main className="relative mx-auto w-full max-w-6xl px-6 pb-24 pt-14 sm:pt-20">
      <RunView runId={runId} />
    </main>
  );
}
