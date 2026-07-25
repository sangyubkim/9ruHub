import { Channel } from "@/generated/prisma/client";
import { CoupangAdapter } from "./coupang";
import { ElevenstAdapter } from "./elevenst";
import { SmartStoreAdapter } from "./smartstore";
import type { ChannelAdapter } from "./types";

const adapters: Record<Channel, ChannelAdapter> = {
  SMARTSTORE: new SmartStoreAdapter(),
  COUPANG: new CoupangAdapter(),
  ELEVENST: new ElevenstAdapter(),
};

export function getChannelAdapter(channel: Channel): ChannelAdapter {
  return adapters[channel];
}

export * from "./types";
export * from "./credentials";
export {
  getChannelInvoiceAdapter,
  INVOICE_CHANNELS,
} from "./invoice";
export type {
  ChannelInvoiceAdapter,
  ChannelInvoiceRequest,
  ChannelInvoiceResult,
  ChannelInvoiceStatusMap,
} from "./invoice-types";
