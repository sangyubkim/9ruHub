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

export type ForwarderTrackResult = {
  success: boolean;
  mode: "stub" | "live";
  status: "PENDING" | "AT_FORWARDER" | "IN_TRANSIT" | "DELIVERED" | "EXCEPTION";
  events: Array<{ at: string; description: string }>;
  message: string;
};

export interface ForwarderAdapter {
  readonly name: string;
  createInbound(req: ForwarderCreateRequest): Promise<ForwarderCreateResult>;
  track(trackingNo: string): Promise<ForwarderTrackResult>;
}
