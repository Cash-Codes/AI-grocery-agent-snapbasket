import { RunView } from "./run-view";

interface PageProps {
  params: Promise<{ runId: string }>;
}

export default async function RunPage({ params }: PageProps) {
  const { runId } = await params;
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <RunView runId={runId} />
    </main>
  );
}
