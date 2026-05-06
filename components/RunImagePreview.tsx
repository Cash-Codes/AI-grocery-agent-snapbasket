"use client";

import { ImageOff } from "lucide-react";
import { useState } from "react";

export function RunImagePreview({ imageId }: { imageId: string }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  if (errored) return null; // silently degrade, the rest of the run-view still works

  return (
    <section className="ring-frost border-border bg-card animate-fade-up rounded-2xl border p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-muted-foreground/80 font-mono text-[10.5px] uppercase tracking-[0.22em]">
          Source image
        </h2>
        <a
          href={`/api/images/${imageId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground/70 hover:text-primary font-mono text-[10.5px] uppercase tracking-[0.18em] transition-colors"
        >
          open ↗
        </a>
      </div>
      <div className="bg-secondary/30 ring-border/60 group relative overflow-hidden rounded-xl ring-1">
        {!loaded && (
          <div
            aria-hidden
            className="bg-secondary/60 absolute inset-0 animate-pulse"
            style={{ aspectRatio: "3 / 4" }}
          />
        )}
        <img
          src={`/api/images/${imageId}`}
          alt="Source grocery list"
          className={[
            "block max-h-[480px] w-full object-contain transition-opacity duration-500",
            loaded ? "opacity-100" : "opacity-0",
          ].join(" ")}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          draggable={false}
        />
        {!loaded && (
          <div className="text-muted-foreground/60 absolute inset-0 flex items-center justify-center">
            <ImageOff className="size-5 opacity-50" strokeWidth={1.5} aria-hidden />
          </div>
        )}
      </div>
    </section>
  );
}
