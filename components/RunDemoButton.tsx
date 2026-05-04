"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function RunDemoButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startDemo() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/runs/demo", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(body?.error?.message ?? `Status ${res.status}`);
      }
      const body = (await res.json()) as { runId: string };
      router.push(`/runs/${body.runId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        size="lg"
        onClick={startDemo}
        disabled={loading}
        className="rounded-full px-8 py-6 text-base"
      >
        {loading ? "Starting run..." : "Run demo"}
      </Button>
      {error && <p className="text-sm text-red-600">Couldn&apos;t start: {error}</p>}
    </div>
  );
}
