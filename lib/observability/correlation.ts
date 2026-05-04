import { randomUUID } from "node:crypto";

export function newCorrelationId(): string {
  return `corr_${randomUUID()}`;
}

export function isCorrelationId(value: string): boolean {
  return /^corr_[0-9a-f-]{36}$/i.test(value);
}
