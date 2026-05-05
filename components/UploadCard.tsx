"use client";

import { ImagePlus, Loader2, RotateCcw, X } from "lucide-react";
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
  const fileSize =
    state.kind === "selected" || state.kind === "uploading"
      ? `${(state.file.size / 1024).toFixed(0)} KB`
      : null;

  return (
    <div className="flex flex-col gap-3.5">
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={state.kind === "idle" ? onPickClick : undefined}
        role={state.kind === "idle" ? "button" : undefined}
        tabIndex={state.kind === "idle" ? 0 : undefined}
        onKeyDown={(e) => {
          if (state.kind !== "idle") return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onPickClick();
          }
        }}
        className={[
          "ring-frost relative overflow-hidden rounded-2xl border px-7 py-12 text-center transition-all duration-300",
          isDragging
            ? "border-primary/60 bg-primary/[0.06] scale-[1.01] shadow-[0_0_0_4px_oklch(0.55_0.165_153/0.16)]"
            : state.kind === "idle"
              ? "border-border bg-card hover:border-primary/40 hover:shadow-[0_8px_28px_-8px_oklch(0.55_0.165_153/0.18)] cursor-pointer"
              : "border-border bg-card",
        ].join(" ")}
      >
        {/* shimmer overlay during upload */}
        {state.kind === "uploading" && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -translate-x-full"
            style={{
              background:
                "linear-gradient(90deg, transparent, oklch(0.55 0.165 153 / 0.10), transparent)",
              animation: "shimmer 2s linear infinite",
              backgroundSize: "200% 100%",
            }}
          />
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={onInputChange}
        />

        {state.kind === "idle" && (
          <div className="flex flex-col items-center gap-3.5">
            <div
              className={[
                "border-border/60 bg-secondary/60 flex size-12 items-center justify-center rounded-xl border transition-all duration-300",
                isDragging
                  ? "border-primary/50 bg-primary/15 scale-110"
                  : "group-hover:border-primary/30",
              ].join(" ")}
            >
              <ImagePlus
                className={[
                  "size-5 transition-colors",
                  isDragging ? "text-primary" : "text-muted-foreground",
                ].join(" ")}
                strokeWidth={1.75}
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-foreground text-sm font-medium">
                Drop a grocery list image here, or click to select
              </p>
              <p className="text-muted-foreground/80 font-mono text-[10.5px] uppercase tracking-[0.18em]">
                PNG, JPEG, or WebP · up to 8 MB
              </p>
            </div>
          </div>
        )}

        {(state.kind === "selected" || state.kind === "uploading") && (
          <div className="flex flex-col items-center gap-3">
            <div className="bg-primary/15 ring-primary/30 flex size-12 items-center justify-center rounded-xl ring-1">
              {state.kind === "uploading" ? (
                <Loader2 className="text-primary size-5 animate-spin" strokeWidth={1.75} />
              ) : (
                <ImagePlus className="text-primary size-5" strokeWidth={1.75} />
              )}
            </div>
            <div className="space-y-1">
              <p className="text-foreground/90 max-w-[28ch] truncate text-sm font-medium">
                {fileName}
              </p>
              <p className="text-muted-foreground/80 font-mono text-[10.5px] uppercase tracking-[0.16em]">
                {state.kind === "uploading" ? "Uploading and starting run..." : fileSize}
              </p>
            </div>
          </div>
        )}

        {state.kind === "error" && (
          <div className="flex flex-col items-center gap-3">
            <div className="bg-destructive/15 ring-destructive/30 flex size-12 items-center justify-center rounded-xl ring-1">
              <X className="text-destructive size-5" strokeWidth={1.75} />
            </div>
            <div className="space-y-1">
              {fileName && (
                <p className="text-foreground/70 max-w-[28ch] truncate text-sm">{fileName}</p>
              )}
              <p className="text-destructive text-[13.5px]">{state.message}</p>
            </div>
          </div>
        )}
      </div>

      {state.kind === "selected" && (
        <div className="animate-fade-in flex gap-2">
          <Button
            size="lg"
            onClick={startRun}
            disabled={isBusy}
            className="bg-primary text-primary-foreground hover:bg-primary/90 h-11 flex-1 rounded-xl text-sm font-semibold shadow-[0_10px_24px_-8px_oklch(0.55_0.165_153/0.45)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-8px_oklch(0.55_0.165_153/0.55)]"
          >
            Start run
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={reset}
            className="border-border/70 hover:bg-secondary hover:border-border h-11 rounded-xl px-5 text-sm font-medium transition-colors"
          >
            Change file
          </Button>
        </div>
      )}

      {state.kind === "error" && (
        <div className="animate-fade-in flex gap-2">
          <Button
            size="lg"
            variant="outline"
            onClick={reset}
            className="border-border/70 hover:bg-secondary hover:border-border h-11 rounded-xl text-sm font-medium transition-colors"
          >
            <RotateCcw className="mr-2 size-3.5" strokeWidth={2} />
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
