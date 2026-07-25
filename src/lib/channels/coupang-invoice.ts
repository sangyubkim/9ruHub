import { Channel } from "@/generated/prisma/client";
import { isCoupangConfigured } from "@/lib/channels/credentials";
import { createCoupangAuthorization } from "@/lib/channels/coupang-hmac";
import { errorMessageFromBody, readJsonSafe } from "@/lib/channels/http";
import type {
  ChannelInvoiceAdapter,
  ChannelInvoiceRequest,
  ChannelInvoiceResult,
} from "@/lib/channels/invoice-types";

const HOST = "https://api-gateway.coupang.com";

/**
 * 쿠팡 Wing 송장 업로드 스켈레톤.
 * 키 없으면 스텁. 키가 있으면 shipment 인보이스 API 경로로 시도.
 */
export class CoupangInvoiceAdapter implements ChannelInvoiceAdapter {
  readonly channel = Channel.COUPANG;
  private readonly fetchImpl: typeof fetch;

  constructor(fetchImpl: typeof fetch = fetch) {
    this.fetchImpl = fetchImpl;
  }

  async registerInvoice(
    req: ChannelInvoiceRequest,
  ): Promise<ChannelInvoiceResult> {
    if (!isCoupangConfigured()) {
      return {
        success: true,
        mode: "stub",
        status: "STUBBED",
        message: "쿠팡 송장 등록 스텁 (API 키 미설정)",
        payload: {
          channel: this.channel,
          orderExternalId: req.orderExternalId ?? null,
          localCarrier: req.localCarrier,
          localTrackingNo: req.localTrackingNo,
          recordedAt: new Date().toISOString(),
        },
      };
    }

    const vendorId = process.env.COUPANG_VENDOR_ID?.trim();
    if (!vendorId || !req.orderExternalId?.trim()) {
      return {
        success: false,
        mode: "live",
        status: "FAILED",
        message: "쿠팡 송장 등록: VENDOR_ID / orderExternalId 필요",
      };
    }

    try {
      const accessKey = process.env.COUPANG_ACCESS_KEY!.trim();
      const secretKey = process.env.COUPANG_SECRET_KEY!.trim();
      const path = `/v2/providers/openapi/apis/api/v4/vendors/${encodeURIComponent(vendorId)}/orders/invoices`;
      const body = {
        vendorId,
        orderSheetInvoiceApplyDtos: [
          {
            shipmentBoxId: Number(req.orderExternalId) || req.orderExternalId,
            orderId: Number(req.orderExternalId) || undefined,
            deliveryCompanyCode: mapCarrierToCoupang(req.localCarrier),
            invoiceNumber: req.localTrackingNo,
            splitShipping: false,
            preSplitShipped: false,
            estimatedShippingDate: new Date().toISOString().slice(0, 10),
          },
        ],
      };
      const { authorization } = createCoupangAuthorization({
        method: "POST",
        pathWithQuery: path,
        accessKey,
        secretKey,
      });
      const res = await this.fetchImpl(`${HOST}${path}`, {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json;charset=UTF-8",
        },
        body: JSON.stringify(body),
      });
      const json = await readJsonSafe(res);
      if (!res.ok) {
        return {
          success: false,
          mode: "live",
          status: "FAILED",
          message: errorMessageFromBody(json, `쿠팡 송장 등록 실패 (${res.status})`),
          payload: { status: res.status, body: json },
        };
      }
      return {
        success: true,
        mode: "live",
        status: "SUCCEEDED",
        message: "쿠팡 송장 등록 완료",
        payload: { body: json },
      };
    } catch (error) {
      return {
        success: false,
        mode: "live",
        status: "FAILED",
        message: error instanceof Error ? error.message : "쿠팡 송장 등록 예외",
      };
    }
  }
}

function mapCarrierToCoupang(carrier: string): string {
  const c = carrier.toLowerCase();
  if (c.includes("cj")) return "CJGLS";
  if (c.includes("한진")) return "HANJIN";
  if (c.includes("롯데")) return "LOTTE";
  if (c.includes("우체국") || c.includes("post")) return "EPOST";
  return "CJGLS";
}
