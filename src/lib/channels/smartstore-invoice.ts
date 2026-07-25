import { Channel } from "@/generated/prisma/client";
import { isSmartStoreConfigured } from "@/lib/channels/credentials";
import { errorMessageFromBody, readJsonSafe } from "@/lib/channels/http";
import type {
  ChannelInvoiceAdapter,
  ChannelInvoiceRequest,
  ChannelInvoiceResult,
} from "@/lib/channels/invoice-types";
import { fetchSmartStoreAccessToken } from "@/lib/channels/smartstore-auth";

const BASE = "https://api.commerce.naver.com/external";

/**
 * 스마트스토어 발주/발송 처리 스켈레톤.
 * 키가 없으면 스텁. 키가 있으면 공식 Commerce API 경로로 시도(주문 ID 필요).
 */
export class SmartStoreInvoiceAdapter implements ChannelInvoiceAdapter {
  readonly channel = Channel.SMARTSTORE;
  private readonly fetchImpl: typeof fetch;

  constructor(fetchImpl: typeof fetch = fetch) {
    this.fetchImpl = fetchImpl;
  }

  async registerInvoice(
    req: ChannelInvoiceRequest,
  ): Promise<ChannelInvoiceResult> {
    if (!isSmartStoreConfigured()) {
      return {
        success: true,
        mode: "stub",
        status: "STUBBED",
        message: "스마트스토어 송장 등록 스텁 (API 키 미설정)",
        payload: {
          channel: this.channel,
          orderExternalId: req.orderExternalId ?? null,
          localCarrier: req.localCarrier,
          localTrackingNo: req.localTrackingNo,
          recordedAt: new Date().toISOString(),
        },
      };
    }

    if (!req.orderExternalId?.trim()) {
      return {
        success: false,
        mode: "live",
        status: "FAILED",
        message: "스마트스토어 송장 등록: orderExternalId 필요",
      };
    }

    try {
      const token = await fetchSmartStoreAccessToken(this.fetchImpl);
      // 발송 처리(상품 주문) — 벤더별 productOrderId 매핑이 필요할 수 있음
      const path = `/v1/pay-order/seller/product-orders/dispatch`;
      const res = await this.fetchImpl(`${BASE}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dispatchProductOrders: [
            {
              productOrderId: req.orderExternalId,
              deliveryMethod: "DELIVERY",
              deliveryCompanyCode: mapCarrierToSmartStore(req.localCarrier),
              trackingNumber: req.localTrackingNo,
              dispatchDate: new Date().toISOString(),
            },
          ],
        }),
      });
      const body = await readJsonSafe(res);
      if (!res.ok) {
        return {
          success: false,
          mode: "live",
          status: "FAILED",
          message: errorMessageFromBody(body, `스마트스토어 송장 등록 실패 (${res.status})`),
          payload: { status: res.status, body },
        };
      }
      return {
        success: true,
        mode: "live",
        status: "SUCCEEDED",
        message: "스마트스토어 송장 등록 완료",
        payload: { body },
      };
    } catch (error) {
      return {
        success: false,
        mode: "live",
        status: "FAILED",
        message:
          error instanceof Error
            ? error.message
            : "스마트스토어 송장 등록 예외",
      };
    }
  }
}

function mapCarrierToSmartStore(carrier: string): string {
  const c = carrier.toLowerCase();
  if (c.includes("cj")) return "CJGLS";
  if (c.includes("한진")) return "HANJIN";
  if (c.includes("롯데")) return "LOTTE";
  if (c.includes("우체국") || c.includes("post")) return "EPOST";
  return "CJGLS";
}
