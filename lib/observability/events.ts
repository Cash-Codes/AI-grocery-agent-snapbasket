import "server-only";

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { workflowEvents } from "@/lib/db/schema";
import type { EventStatus, WorkflowStep } from "@/lib/domain/types";

export interface EmitWorkflowEventInput {
  runId: string;
  step: WorkflowStep;
  status: EventStatus;
  attempt: number;
  correlationId: string;
  payload?: unknown;
  error?: { message: string; stack?: string };
}

export async function emitWorkflowEvent(input: EmitWorkflowEventInput): Promise<void> {
  const db = getDb();
  await db
    .insert(workflowEvents)
    .values({
      id: `evt_${randomUUID()}`,
      runId: input.runId,
      step: input.step,
      status: input.status,
      attempt: input.attempt,
      correlationId: input.correlationId,
      payloadJson: input.payload ? JSON.stringify(input.payload) : null,
      errorJson: input.error ? JSON.stringify(input.error) : null,
    })
    .run();
}

export async function readWorkflowEvents(runId: string) {
  const db = getDb();
  return db.select().from(workflowEvents).where(eq(workflowEvents.runId, runId)).all();
}
