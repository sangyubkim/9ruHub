import type { Channel } from "@/generated/prisma/client";

export type InvoiceRegisterRequest = {
  channel: Channel;
  orderExternalId?: string | null;
  localCarrier: string;
  localTrackingNo: string;
  draftExternalProductId?: string | null;
};

export type InvoiceRegisterResult = {
  success: boolean;
  mode: "stub" | "live";
  status: "STUBBED" | "SUCCEEDED" | "FAILED";
  message: string;
  payload?: Record<string, unknown>;
};

export interface InvoiceRegisterAdapter {
  readonly name: string;
  register(req: InvoiceRegisterRequest): Promise<InvoiceRegisterResult>;
}
