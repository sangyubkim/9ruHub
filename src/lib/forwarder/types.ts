export type ForwarderCreateRequest = {
  orderId: string;
  shipmentId: string;
  customerName?: string | null;
  shippingAddress?: unknown;
  weightGrams?: number | null;
};

export type ForwarderCreateResult = {
  success: boolean;
  mode: "stub" | "live";
  forwarderCode: string;
  trackingNo: string;
  message: string;
  payload?: Record<string, unknown>;
};

export type ForwarderShipmentStatus =
  | "PENDING"
  | "AT_FORWARDER"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "EXCEPTION";

export type ForwarderTrackResult = {
  success: boolean;
  mode: "stub" | "live";
  status: ForwarderShipmentStatus;
  events: Array<{ at: string; description: string }>;
  message: string;
  localCarrier?: string | null;
  localTrackingNo?: string | null;
};

export type ForwarderPollResult = {
  success: boolean;
  mode: "stub" | "live";
  status: ForwarderShipmentStatus;
  message: string;
  events: Array<{ at: string; description: string }>;
  forwarderTrackingNo?: string | null;
  localCarrier?: string | null;
  localTrackingNo?: string | null;
  payload?: Record<string, unknown>;
};

export type ForwarderTrackingFetchResult = {
  success: boolean;
  mode: "stub" | "live";
  localCarrier: string;
  localTrackingNo: string;
  message: string;
  payload?: Record<string, unknown>;
};

export interface ForwarderAdapter {
  readonly name: string;
  createInbound(req: ForwarderCreateRequest): Promise<ForwarderCreateResult>;
  track(trackingNo: string): Promise<ForwarderTrackResult>;
  /** 배대지 입고(센터 도착) 확인 */
  pollInbound(
    shipmentId: string,
    forwarderTrackingNo?: string | null,
  ): Promise<ForwarderPollResult>;
  /** 배대지 출고(국내 발송) 확인 */
  pollOutbound(
    shipmentId: string,
    forwarderTrackingNo?: string | null,
  ): Promise<ForwarderPollResult>;
  /** 국내 송장번호 수집 */
  fetchTrackingNumber(
    shipmentId: string,
    forwarderTrackingNo?: string | null,
  ): Promise<ForwarderTrackingFetchResult>;
}
