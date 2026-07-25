import { Channel } from "@/generated/prisma/client";
import { CoupangInvoiceAdapter } from "@/lib/channels/coupang-invoice";
import { ElevenstAdapter } from "@/lib/channels/elevenst";
import type { ChannelInvoiceAdapter } from "@/lib/channels/invoice-types";
import { SmartStoreInvoiceAdapter } from "@/lib/channels/smartstore-invoice";

const invoiceAdapters: Record<Channel, ChannelInvoiceAdapter> = {
  SMARTSTORE: new SmartStoreInvoiceAdapter(),
  COUPANG: new CoupangInvoiceAdapter(),
  ELEVENST: new ElevenstAdapter(),
};

export function getChannelInvoiceAdapter(
  channel: Channel,
): ChannelInvoiceAdapter {
  return invoiceAdapters[channel];
}

export const INVOICE_CHANNELS: Channel[] = [
  Channel.SMARTSTORE,
  Channel.COUPANG,
  Channel.ELEVENST,
];

export * from "@/lib/channels/invoice-types";
