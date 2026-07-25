import type { Channel } from "@/generated/prisma/client";

export type ChannelInvoiceRequest = {
  orderExternalId?: string | null;
  localCarrier: string;
  localTrackingNo: string;
};

export type ChannelInvoiceResult = {
  success: boolean;
  mode: "stub" | "live";
  status: "STUBBED" | "SUCCEEDED" | "FAILED";
  message: string;
  payload?: Record<string, unknown>;
};

/** 채널별 송장/운송장 업로드 어댑터 */
export interface ChannelInvoiceAdapter {
  readonly channel: Channel;
  registerInvoice(req: ChannelInvoiceRequest): Promise<ChannelInvoiceResult>;
}

export type ChannelInvoiceStatusMap = Partial<
  Record<
    Channel,
    {
      status: ChannelInvoiceResult["status"];
      mode: ChannelInvoiceResult["mode"];
      message: string;
      at: string;
      success: boolean;
    }
  >
>;
