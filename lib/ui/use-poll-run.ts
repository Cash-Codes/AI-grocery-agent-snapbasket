"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface RunSnapshot {
  run: {
    id: string;
    imageId: string;
    userId: string;
    status: string;
    triggerRunId: string | null;
    approvalTokenId: string | null;
    correlationId: string;
    failureStep: string | null;
    createdAt: string | Date;
    updatedAt: string | Date;
  };
  intents: unknown[];
  candidatesByIntent: Record<string, unknown[]>;
  basket: unknown | null;
  items: unknown[];
  policy: unknown | null;
  events: Array<{
    id: string;
    runId: string;
    step: string;
    status: string;
    attempt: number;
    correlationId: string;
    payloadJson: string | null;
    errorJson: string | null;
    timestamp: string | Date;
  }>;
}

const TERMINAL_STATUSES = new Set(["COMPLETED", "REJECTED", "TIMED_OUT", "FAILED"]);
const POLL_INTERVAL_MS = 1500;

export function usePollRun(runId: string) {
  const [data, setData] = useState<RunSnapshot | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const cancelledRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchOnce = useCallback(async (): Promise<RunSnapshot | null> => {
    const res = await fetch(`/api/runs/${runId}`, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`GET /api/runs/${runId} failed: ${res.status}`);
    }
    return (await res.json()) as RunSnapshot;
  }, [runId]);

  const refetch = useCallback(async () => {
    try {
      const fresh = await fetchOnce();
      if (!cancelledRef.current && fresh) setData(fresh);
    } catch (err) {
      if (!cancelledRef.current) setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [fetchOnce]);

  useEffect(() => {
    cancelledRef.current = false;

    async function poll() {
      try {
        const fresh = await fetchOnce();
        if (cancelledRef.current || !fresh) return;
        setData(fresh);
        if (!TERMINAL_STATUSES.has(fresh.run.status)) {
          timeoutRef.current = setTimeout(() => void poll(), POLL_INTERVAL_MS);
        }
      } catch (err) {
        if (cancelledRef.current) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    }

    void poll();

    return () => {
      cancelledRef.current = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [fetchOnce]);

  return { data, error, refetch };
}
