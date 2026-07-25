import {
  OrderStatus,
  Prisma,
  PurchaseAttemptStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getDefaultTenantId } from "@/lib/tenant";
import { getMall1688Adapter } from "@/lib/orders/auto-order/adapter";
import { appendOrderEvent } from "@/lib/orders/auto-order/events";
import { getForwarderAddress } from "@/lib/orders/auto-order/forwarder-address";
import {
  assertTransition,
  canStartAutoOrder,
  isAwaitingPaymentConfirm,
  isAutoOrderTerminal,
  pipelineChecklist,
} from "@/lib/orders/auto-order/transitions";

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function loadOrder(orderId: string, tenantId?: string) {
  const resolvedTenantId = tenantId ?? (await getDefaultTenantId());
  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId: resolvedTenantId },
    include: {
      items: true,
      events: { orderBy: { createdAt: "asc" } },
      shipment: true,
    },
  });
  if (!order) throw new Error("주문을 찾을 수 없습니다.");
  return order;
}

async function setStatus(
  orderId: string,
  from: OrderStatus,
  to: OrderStatus,
  extra?: { purchasedAt?: Date },
) {
  assertTransition(from, to);
  return prisma.order.update({
    where: { id: orderId },
    data: {
      status: to,
      ...(extra?.purchasedAt ? { purchasedAt: extra.purchasedAt } : {}),
    },
  });
}

/**
 * 자동주문 시작: 결제 확인 게이트(AWAITING_PAYMENT_CONFIRM)까지 진행 후 멈춤.
 */
export async function startAutoOrder(orderId: string, tenantId?: string) {
  const order = await loadOrder(orderId, tenantId);

  if (isAutoOrderTerminal(order.status)) {
    throw new Error(`이미 종료된 주문입니다: ${order.status}`);
  }
  if (isAwaitingPaymentConfirm(order.status)) {
    return {
      order: await loadOrder(orderId, tenantId),
      stoppedAt: OrderStatus.AWAITING_PAYMENT_CONFIRM as const,
      checklist: pipelineChecklist(order.status),
      message:
        "결제 확인 대기 중입니다. confirm-payment API로 계속하세요.",
    };
  }

  const startable =
    canStartAutoOrder(order.status) ||
    order.status === OrderStatus.PURCHASE_REQUESTED ||
    order.status === OrderStatus.PURCHASED;
  if (!startable) {
    throw new Error(
      `자동주문을 시작할 수 없는 상태입니다: ${order.status}`,
    );
  }

  const adapter = getMall1688Adapter();
  let current = order.status;

  await appendOrderEvent({
    orderId,
    step: "START",
    message: `자동주문 시작 (adapter=${adapter.name}, mode=${adapter.mode})`,
    payload: { fromStatus: current },
  });

  // PENDING 또는 legacy → SOURCING
  if (
    current === OrderStatus.PENDING ||
    current === OrderStatus.PURCHASE_REQUESTED ||
    current === OrderStatus.PURCHASED
  ) {
    if (current === OrderStatus.PENDING) {
      await setStatus(orderId, current, OrderStatus.SOURCING);
    } else {
      // legacy 스텁 구매 상태 → 파이프라인 SOURCING으로 재진입
      await prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.SOURCING },
      });
    }
    current = OrderStatus.SOURCING;
    await appendOrderEvent({
      orderId,
      step: "SOURCING",
      message: "1688 소싱 단계 진입",
      payload: { adapter: adapter.name },
    });
  }

  if (current === OrderStatus.SOURCING) {
    const cart = await adapter.addToCart(
      order.items.map((item) => ({
        orderItemId: item.id,
        title: item.title,
        quantity: item.quantity,
        sourceUrl: item.sourceUrl,
        unitCostKrw: item.unitCostKrw,
      })),
    );
    if (!cart.success) {
      await appendOrderEvent({
        orderId,
        step: "ERROR",
        message: cart.message,
        payload: cart.payload,
      });
      throw new Error(cart.message);
    }

    for (const item of order.items) {
      await prisma.orderItem.update({
        where: { id: item.id },
        data: {
          purchaseMall: adapter.name,
          purchaseStatus: PurchaseAttemptStatus.QUEUED,
          purchaseRef: cart.ref ?? item.purchaseRef,
          purchasePayload: cart.payload ? toJson(cart.payload) : undefined,
        },
      });
    }

    await setStatus(orderId, OrderStatus.SOURCING, OrderStatus.CART_READY);
    current = OrderStatus.CART_READY;
    await appendOrderEvent({
      orderId,
      step: "ADD_TO_CART",
      message: cart.message,
      payload: cart.payload,
    });
  }

  if (current === OrderStatus.CART_READY) {
    const checkout = await adapter.checkout(orderId);
    if (!checkout.success) {
      await appendOrderEvent({
        orderId,
        step: "ERROR",
        message: checkout.message,
        payload: checkout.payload,
      });
      throw new Error(checkout.message);
    }

    await setStatus(
      orderId,
      OrderStatus.CART_READY,
      OrderStatus.AWAITING_PAYMENT_CONFIRM,
    );
    current = OrderStatus.AWAITING_PAYMENT_CONFIRM;
    await appendOrderEvent({
      orderId,
      step: "AWAITING_PAYMENT_CONFIRM",
      message:
        "결제 확인 게이트: confirmPayment 없이는 진행하지 않습니다.",
      payload: {
        ...checkout.payload,
        gate: "AWAITING_PAYMENT_CONFIRM",
        requireConfirmPayment: true,
      },
    });
  }

  const refreshed = await loadOrder(orderId, tenantId);
  return {
    order: refreshed,
    stoppedAt: OrderStatus.AWAITING_PAYMENT_CONFIRM as const,
    checklist: pipelineChecklist(refreshed.status),
    message:
      "결제 확인 대기. POST .../auto-order/confirm-payment { confirmPayment: true }",
  };
}

/**
 * 결제 확인 후 배대지 주소 → 주문 완료까지 진행.
 * confirmPayment: true 필수 (스텁 포함).
 */
export async function confirmAutoOrderPayment(
  orderId: string,
  input: { confirmPayment?: boolean },
  tenantId?: string,
) {
  if (input.confirmPayment !== true) {
    throw new Error(
      "결제 진행에는 confirmPayment: true 가 필요합니다 (무확인 결제 금지).",
    );
  }

  const order = await loadOrder(orderId, tenantId);
  if (!isAwaitingPaymentConfirm(order.status)) {
    throw new Error(
      `결제 확인 가능한 상태가 아닙니다: ${order.status} (필요: AWAITING_PAYMENT_CONFIRM)`,
    );
  }

  const adapter = getMall1688Adapter();
  let current = order.status;

  await appendOrderEvent({
    orderId,
    step: "PAYMENT_CONFIRMED",
    message: "운영자 결제 확인 수신 — 결제 단계 진행",
    payload: { confirmPayment: true, adapter: adapter.name },
  });

  const pay = await adapter.pay(orderId, { confirmPayment: true });
  if (!pay.success) {
    await appendOrderEvent({
      orderId,
      step: "ERROR",
      message: pay.message,
      payload: pay.payload,
    });
    throw new Error(pay.message);
  }

  await setStatus(orderId, current, OrderStatus.PAID, {
    purchasedAt: new Date(),
  });
  current = OrderStatus.PAID;
  await appendOrderEvent({
    orderId,
    step: "PAYMENT_CONFIRMED",
    message: pay.message,
    payload: pay.payload,
  });

  for (const item of order.items) {
    await prisma.orderItem.update({
      where: { id: item.id },
      data: {
        purchaseMall: adapter.name,
        purchaseStatus:
          adapter.mode === "stub"
            ? PurchaseAttemptStatus.STUBBED
            : PurchaseAttemptStatus.SUCCEEDED,
        purchaseRef: pay.ref ?? item.purchaseRef,
        purchasePayload: pay.payload ? toJson(pay.payload) : undefined,
      },
    });
  }

  const address = getForwarderAddress();
  const addrResult = await adapter.setForwarderAddress(orderId, address);
  if (!addrResult.success) {
    await appendOrderEvent({
      orderId,
      step: "ERROR",
      message: addrResult.message,
      payload: addrResult.payload,
    });
    throw new Error(addrResult.message);
  }

  await setStatus(
    orderId,
    OrderStatus.PAID,
    OrderStatus.FORWARDER_ADDRESS_SET,
  );
  current = OrderStatus.FORWARDER_ADDRESS_SET;
  await appendOrderEvent({
    orderId,
    step: "SET_FORWARDER_ADDRESS",
    message: addrResult.message,
    payload: { ...addrResult.payload, address },
  });

  const done = await adapter.complete(orderId);
  if (!done.success) {
    await appendOrderEvent({
      orderId,
      step: "ERROR",
      message: done.message,
      payload: done.payload,
    });
    throw new Error(done.message);
  }

  await setStatus(
    orderId,
    OrderStatus.FORWARDER_ADDRESS_SET,
    OrderStatus.PURCHASE_COMPLETE,
  );
  await appendOrderEvent({
    orderId,
    step: "COMPLETE",
    message: done.message,
    payload: done.payload,
  });

  const refreshed = await loadOrder(orderId, tenantId);
  return {
    order: refreshed,
    checklist: pipelineChecklist(refreshed.status),
    message: "자동주문 파이프라인 완료",
  };
}
