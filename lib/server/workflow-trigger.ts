import "server-only";

import { tasks } from "@trigger.dev/sdk";

import type { snapbasketWorkflow } from "@/trigger/workflow";

export interface TriggerSnapbasketRunInput {
  runId: string;
  correlationId: string;
  imageId: string;
  sha256: string;
  imageBytes: Uint8Array;
  mime: string;
}

export interface TriggerSnapbasketRunResult {
  triggerRunId: string;
}

export async function triggerSnapbasketRun(
  input: TriggerSnapbasketRunInput,
): Promise<TriggerSnapbasketRunResult> {
  const handle = await tasks.trigger<typeof snapbasketWorkflow>("snapbasket.run", input);
  return { triggerRunId: handle.id };
}
