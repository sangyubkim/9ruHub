import { getChannelInvoiceAdapter } from "@/lib/channels/invoice";
import type {
  InvoiceRegisterAdapter,
  InvoiceRegisterRequest,
  InvoiceRegisterResult,
} from "@/lib/invoice/types";

/**
 * 레거시 단일 어댑터 파사드 — 채널별 ChannelInvoiceAdapter로 위임.
 */
export function getInvoiceRegisterAdapter(): InvoiceRegisterAdapter {
  return {
    name: "channel-invoice-facade",
    async register(req: InvoiceRegisterRequest): Promise<InvoiceRegisterResult> {
      const adapter = getChannelInvoiceAdapter(req.channel);
      const result = await adapter.registerInvoice({
        orderExternalId: req.orderExternalId,
        localCarrier: req.localCarrier,
        localTrackingNo: req.localTrackingNo,
      });
      return {
        success: result.success,
        mode: result.mode,
        status: result.status,
        message: result.message,
        payload: result.payload,
      };
    },
  };
}

export type {
  InvoiceRegisterAdapter,
  InvoiceRegisterRequest,
  InvoiceRegisterResult,
} from "@/lib/invoice/types";
