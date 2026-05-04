import { MockUcpCommerceProvider } from "./mock-ucp";
import type { CommerceProvider } from "./types";

export type { CommerceProvider, CreateBasketInput, CreateCheckoutSessionInput } from "./types";

// mock for now, future impl would have real UCP http client
export const commerceProvider: CommerceProvider = new MockUcpCommerceProvider();
