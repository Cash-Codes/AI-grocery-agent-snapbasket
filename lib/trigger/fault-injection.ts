export function maybeInjectFault(taskId: string, attempt: number): void {
  if (attempt > 1) return; // only fail attempt 1
  const rate = Number.parseFloat(process.env.MOCK_FAULT_RATE ?? "0");
  if (Number.isNaN(rate) || rate <= 0) return;
  if (Math.random() < rate) {
    throw new Error(`MOCK_FAULT injected in ${taskId} (rate=${rate}, attempt=${attempt})`);
  }
}
