import { describe, expect, it } from "vitest";
import { OrderStatus } from "@/generated/prisma/client";
import {
  assertTransition,
  canStartAutoOrder,
  canTransition,
  isAwaitingPaymentConfirm,
  pipelineChecklist,
} from "@/lib/orders/auto-order/transitions";

describe("auto-order transitions", () => {
  it("allows the happy-path pipeline", () => {
    expect(canTransition(OrderStatus.PENDING, OrderStatus.SOURCING)).toBe(true);
    expect(canTransition(OrderStatus.SOURCING, OrderStatus.CART_READY)).toBe(
      true,
    );
    expect(
      canTransition(OrderStatus.CART_READY, OrderStatus.AWAITING_PAYMENT_CONFIRM),
    ).toBe(true);
    expect(
      canTransition(
        OrderStatus.AWAITING_PAYMENT_CONFIRM,
        OrderStatus.PAID,
      ),
    ).toBe(true);
    expect(
      canTransition(OrderStatus.PAID, OrderStatus.FORWARDER_ADDRESS_SET),
    ).toBe(true);
    expect(
      canTransition(
        OrderStatus.FORWARDER_ADDRESS_SET,
        OrderStatus.PURCHASE_COMPLETE,
      ),
    ).toBe(true);
  });

  it("blocks skipping the payment gate", () => {
    expect(
      canTransition(OrderStatus.CART_READY, OrderStatus.PAID),
    ).toBe(false);
    expect(
      canTransition(OrderStatus.AWAITING_PAYMENT_CONFIRM, OrderStatus.PURCHASE_COMPLETE),
    ).toBe(false);
    expect(() =>
      assertTransition(OrderStatus.CART_READY, OrderStatus.PAID),
    ).toThrow(/전이 불가/);
  });

  it("marks awaiting confirm on checklist", () => {
    const list = pipelineChecklist(OrderStatus.AWAITING_PAYMENT_CONFIRM);
    const gate = list.find((s) => s.status === "AWAITING_PAYMENT_CONFIRM");
    expect(gate?.current).toBe(true);
    expect(gate?.awaitingConfirm).toBe(true);
    expect(list.find((s) => s.status === "CART_READY")?.done).toBe(true);
    expect(list.find((s) => s.status === "PAID")?.done).toBe(false);
  });

  it("start/confirm gates", () => {
    expect(canStartAutoOrder(OrderStatus.PENDING)).toBe(true);
    expect(canStartAutoOrder(OrderStatus.AWAITING_PAYMENT_CONFIRM)).toBe(false);
    expect(isAwaitingPaymentConfirm(OrderStatus.AWAITING_PAYMENT_CONFIRM)).toBe(
      true,
    );
  });
});
