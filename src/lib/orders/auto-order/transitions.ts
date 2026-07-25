import { OrderStatus } from "@/generated/prisma/client";
import {
  AUTO_ORDER_PIPELINE,
  type AutoOrderPipelineStatus,
} from "@/lib/orders/auto-order/types";

const PIPELINE_SET = new Set<string>(AUTO_ORDER_PIPELINE);

/** 허용된 단방향 전이 */
const ALLOWED: Record<string, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.SOURCING],
  [OrderStatus.SOURCING]: [OrderStatus.CART_READY],
  [OrderStatus.CART_READY]: [OrderStatus.AWAITING_PAYMENT_CONFIRM],
  [OrderStatus.AWAITING_PAYMENT_CONFIRM]: [OrderStatus.PAID],
  [OrderStatus.PAID]: [OrderStatus.FORWARDER_ADDRESS_SET],
  [OrderStatus.FORWARDER_ADDRESS_SET]: [OrderStatus.PURCHASE_COMPLETE],
};

export function isPipelineStatus(
  status: string,
): status is AutoOrderPipelineStatus {
  return PIPELINE_SET.has(status);
}

export function canTransition(
  from: OrderStatus | string,
  to: OrderStatus | string,
): boolean {
  const next = ALLOWED[from];
  if (!next) return false;
  return next.includes(to as OrderStatus);
}

export function assertTransition(
  from: OrderStatus | string,
  to: OrderStatus | string,
): void {
  if (!canTransition(from, to)) {
    throw new Error(`자동주문 상태 전이 불가: ${from} → ${to}`);
  }
}

export function pipelineIndex(status: string): number {
  return AUTO_ORDER_PIPELINE.indexOf(status as AutoOrderPipelineStatus);
}

/** 현재 상태까지 완료된 단계 체크리스트 */
export function pipelineChecklist(current: string): Array<{
  status: AutoOrderPipelineStatus;
  label: string;
  done: boolean;
  current: boolean;
  awaitingConfirm: boolean;
}> {
  const labels: Record<AutoOrderPipelineStatus, string> = {
    PENDING: "주문 유입",
    SOURCING: "1688 소싱",
    CART_READY: "장바구니 담기",
    AWAITING_PAYMENT_CONFIRM: "결제 확인 대기",
    PAID: "결제 완료",
    FORWARDER_ADDRESS_SET: "배대지 주소 입력",
    PURCHASE_COMPLETE: "주문 완료",
  };

  const idx = pipelineIndex(current);
  const effectiveIdx = idx >= 0 ? idx : 0;

  return AUTO_ORDER_PIPELINE.map((status, i) => ({
    status,
    label: labels[status],
    done: idx >= 0 ? i < effectiveIdx : false,
    current: idx >= 0 ? i === effectiveIdx : status === "PENDING",
    awaitingConfirm: status === "AWAITING_PAYMENT_CONFIRM" && current === status,
  }));
}

/** start 가 허용되는 초기/재시작 가능 상태 */
export function canStartAutoOrder(status: OrderStatus | string): boolean {
  return (
    status === OrderStatus.PENDING ||
    status === OrderStatus.SOURCING ||
    status === OrderStatus.CART_READY
  );
}

export function isAwaitingPaymentConfirm(
  status: OrderStatus | string,
): boolean {
  return status === OrderStatus.AWAITING_PAYMENT_CONFIRM;
}

export function isAutoOrderTerminal(status: OrderStatus | string): boolean {
  return (
    status === OrderStatus.PURCHASE_COMPLETE ||
    status === OrderStatus.CANCELLED ||
    status === OrderStatus.REFUNDED
  );
}
