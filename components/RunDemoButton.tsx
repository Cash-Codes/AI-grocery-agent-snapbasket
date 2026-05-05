"use client";

import { ArrowRight } from "lucide-react";
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
        variant="outline"
        onClick={startDemo}
        disabled={loading}
        className="border-border/70 hover:border-primary/40 hover:bg-secondary/70 hover:text-foreground group h-11 rounded-xl px-5 text-sm font-medium transition-all"
      >
        <span className="inline-flex items-center gap-2">
          {loading ? "Starting run..." : "Run demo"}
          {!loading && (
            <ArrowRight
              aria-hidden
              className="text-muted-foreground group-hover:text-primary size-3.5 transition-all duration-200 group-hover:translate-x-0.5"
              strokeWidth={2}
            />
          )}
        </span>
      </Button>
      {error && <p className="text-destructive text-sm">Couldn&apos;t start: {error}</p>}
    </div>
  );
}
