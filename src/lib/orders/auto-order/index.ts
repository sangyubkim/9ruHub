export { getMall1688Adapter } from "@/lib/orders/auto-order/adapter";
export { StubMall1688Adapter } from "@/lib/orders/auto-order/stub-adapter";
export { LiveHookMall1688Adapter } from "@/lib/orders/auto-order/live-hook";
export { getForwarderAddress } from "@/lib/orders/auto-order/forwarder-address";
export { appendOrderEvent, listOrderEvents } from "@/lib/orders/auto-order/events";
export {
  startAutoOrder,
  confirmAutoOrderPayment,
} from "@/lib/orders/auto-order/pipeline";
export {
  AUTO_ORDER_PIPELINE,
  type AutoOrderPipelineStatus,
  type AutoOrderStep,
  type ForwarderAddress,
  type Mall1688Adapter,
  type Mall1688AdapterResult,
  type Mall1688CartItem,
} from "@/lib/orders/auto-order/types";
export {
  assertTransition,
  canStartAutoOrder,
  canTransition,
  isAwaitingPaymentConfirm,
  isAutoOrderTerminal,
  isPipelineStatus,
  pipelineChecklist,
  pipelineIndex,
} from "@/lib/orders/auto-order/transitions";
