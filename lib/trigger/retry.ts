export const STANDARD_RETRY = {
  maxAttempts: 3,
  factor: 2,
  minTimeoutInMs: 1000,
  maxTimeoutInMs: 16000,
  randomize: false,
};

export const SHORT_RETRY = {
  maxAttempts: 2,
  factor: 2,
  minTimeoutInMs: 1000,
  maxTimeoutInMs: 4000,
  randomize: false,
};

export const NO_RETRY = { maxAttempts: 1 };
