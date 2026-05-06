import type { ProductIntent } from "@/lib/domain/types";

// What the parser produces, before the workflow assigns identity (`id` + `runId`).
// for now keeps parser pure no DB awareness, no run context awareness, no IO.
export type ParsedGroceryIntent = Omit<ProductIntent, "id" | "runId">;
