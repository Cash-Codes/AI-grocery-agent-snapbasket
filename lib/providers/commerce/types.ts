import type {
  Basket,
  BasketItemDraft,
  BasketPatch,
  CheckoutSession,
  OrderStatus,
  ProductMatch,
  ProductQuery,
  UserConsent,
} from "@/lib/domain/types";

export interface CreateBasketInput {
  userId: string;
  runId: string;
  items: BasketItemDraft[];
  idempotencyKey: string;
}

export interface CreateCheckoutSessionInput {
  basketId: string;
  consent: UserConsent;
  idempotencyKey: string;
}

export interface CommerceProvider {
  readonly name: string;
  searchProducts(q: ProductQuery): Promise<ProductMatch[]>;
  createBasket(input: CreateBasketInput): Promise<Basket>;
  updateBasket(input: BasketPatch): Promise<Basket>;
  createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CheckoutSession>;
  getOrderStatus(sessionId: string): Promise<OrderStatus>;
}
