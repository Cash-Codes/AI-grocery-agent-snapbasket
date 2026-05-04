const RATE = Number.parseFloat(process.env.MOCK_FAULT_RATE ?? "0");

export function maybeInjectFault(taskId: string, attempt: number): void {
  if (attempt > 1) return; // only fail attempt 1
  if (Number.isNaN(RATE) || RATE <= 0) return;
  if (Math.random() < RATE) {
    throw new Error(`MOCK_FAULT injected in ${taskId} (rate=${RATE}, attempt=${attempt})`);
  }
}
