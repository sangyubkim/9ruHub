import type { OrderStatus } from "@/generated/prisma/client";

/** UI/문서용 파이프라인 단계 (PENDING = 주문 유입/RECEIVED) */
export const AUTO_ORDER_PIPELINE = [
  "PENDING",
  "SOURCING",
  "CART_READY",
  "AWAITING_PAYMENT_CONFIRM",
  "PAID",
  "FORWARDER_ADDRESS_SET",
  "PURCHASE_COMPLETE",
] as const satisfies readonly OrderStatus[];

export type AutoOrderPipelineStatus = (typeof AUTO_ORDER_PIPELINE)[number];

export type AutoOrderStep =
  | "START"
  | "SOURCING"
  | "ADD_TO_CART"
  | "CHECKOUT"
  | "AWAITING_PAYMENT_CONFIRM"
  | "PAYMENT_CONFIRMED"
  | "SET_FORWARDER_ADDRESS"
  | "COMPLETE"
  | "ERROR";

export type ForwarderAddress = {
  name: string;
  phone: string;
  country: string;
  province: string;
  city: string;
  district: string;
  address1: string;
  address2?: string;
  postalCode: string;
};

export type Mall1688CartItem = {
  orderItemId: string;
  title: string;
  quantity: number;
  sourceUrl?: string | null;
  unitCostKrw?: number;
};

export type Mall1688AdapterResult = {
  success: boolean;
  mode: "stub" | "live-hook";
  ref?: string;
  message: string;
  payload?: Record<string, unknown>;
};

/**
 * 1688 자동주문 어댑터.
 * 결제(checkout→paid)는 파이프라인이 별도 확인 게이트를 강제한다.
 */
export interface Mall1688Adapter {
  readonly name: string;
  readonly mode: "stub" | "live-hook";
  addToCart(items: Mall1688CartItem[]): Promise<Mall1688AdapterResult>;
  checkout(orderId: string): Promise<Mall1688AdapterResult>;
  /** 실결제 — 호출 전에 반드시 confirmPayment 게이트를 통과해야 함 */
  pay(orderId: string, opts: { confirmPayment: true }): Promise<Mall1688AdapterResult>;
  setForwarderAddress(
    orderId: string,
    address: ForwarderAddress,
  ): Promise<Mall1688AdapterResult>;
  complete(orderId: string): Promise<Mall1688AdapterResult>;
}
