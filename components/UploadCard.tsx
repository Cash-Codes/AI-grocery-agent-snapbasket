"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";

// mirrors lib/server/upload.ts. server-side is authoritative, this is UX.
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp"] as const;
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

type UploadState =
  | { kind: "idle" }
  | { kind: "selected"; file: File }
  | { kind: "uploading"; file: File }
  | { kind: "error"; file: File | null; message: string };

export function UploadCard() {
  const router = useRouter();
  const [state, setState] = useState<UploadState>({ kind: "idle" });
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function validate(file: File): string | null {
    if (!ALLOWED_MIME.includes(file.type as (typeof ALLOWED_MIME)[number])) {
      return "Unsupported format. Use PNG, JPEG, or WebP.";
    }
    if (file.size > MAX_BYTES) {
      return `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max is 8 MB.`;
    }
    if (file.size === 0) {
      return "File is empty.";
    }
    return null;
  }

  function handleFile(file: File) {
    const err = validate(file);
    if (err) {
      setState({ kind: "error", file: null, message: err });
      return;
    }
    setState({ kind: "selected", file });
  }

  function onPickClick() {
    inputRef.current?.click();
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // reset so re-selecting the same file fires onChange
    e.target.value = "";
  }

  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function onDragLeave() {
    setIsDragging(false);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  async function startRun() {
    if (state.kind !== "selected") return;
    const file = state.file;
    setState({ kind: "uploading", file });

    try {
      // 1: upload bytes
      const form = new FormData();
      form.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: form });
      if (!uploadRes.ok) {
        const body = (await uploadRes.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(body?.error?.message ?? `Upload failed (status ${uploadRes.status})`);
      }
      const upload = (await uploadRes.json()) as { imageId: string };

      // 2: start a workflow run
      const runRes = await fetch("/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageId: upload.imageId }),
      });
      if (!runRes.ok) {
        const body = (await runRes.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(body?.error?.message ?? `Run start failed (status ${runRes.status})`);
      }
      const run = (await runRes.json()) as { runId: string };

      router.push(`/runs/${run.runId}`);
    } catch (err) {
      setState({
        kind: "error",
        file,
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  function reset() {
    setState({ kind: "idle" });
  }

  const isBusy = state.kind === "uploading";
  const fileName =
    state.kind === "selected" || state.kind === "uploading"
      ? state.file.name
      : state.kind === "error" && state.file
        ? state.file.name
        : null;

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={state.kind === "idle" ? onPickClick : undefined}
        className={[
          "rounded-2xl border-2 border-dashed p-8 text-center transition-colors",
          isDragging
            ? "border-zinc-900 bg-zinc-50"
            : state.kind === "idle"
              ? "cursor-pointer border-zinc-300 hover:border-zinc-500 hover:bg-zinc-50"
              : "border-zinc-300",
        ].join(" ")}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={onInputChange}
        />
        {state.kind === "idle" && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-zinc-900">
              Drop a grocery list image here, or click to select
            </p>
            <p className="text-xs text-zinc-500">PNG, JPEG, or WebP · up to 8 MB</p>
          </div>
        )}
        {fileName && <p className="break-all font-mono text-xs text-zinc-700">{fileName}</p>}
        {state.kind === "uploading" && (
          <p className="mt-2 text-xs text-zinc-500">Uploading and starting run...</p>
        )}
        {state.kind === "error" && <p className="mt-2 text-sm text-red-600">{state.message}</p>}
      </div>

      {state.kind === "selected" && (
        <div className="flex gap-2">
          <Button size="lg" onClick={startRun} disabled={isBusy} className="rounded-full px-6">
            Start run
          </Button>
          <Button size="lg" variant="outline" onClick={reset} className="rounded-full px-6">
            Change file
          </Button>
        </div>
      )}

      {state.kind === "error" && (
        <div className="flex gap-2">
          <Button size="lg" variant="outline" onClick={reset} className="rounded-full px-6">
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
