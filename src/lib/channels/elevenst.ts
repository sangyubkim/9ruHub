import { Channel } from "@/generated/prisma/client";
import { isElevenstConfigured } from "@/lib/channels/credentials";
import { errorMessageFromBody, readJsonSafe } from "@/lib/channels/http";
import type {
  ChannelInvoiceAdapter,
  ChannelInvoiceRequest,
  ChannelInvoiceResult,
} from "@/lib/channels/invoice-types";
import type {
  ChannelAdapter,
  ChannelProductPayload,
  PublishResult,
  SyncResult,
} from "@/lib/channels/types";

export { isElevenstConfigured };

/**
 * 11번가 상품/송장 어댑터 스텁.
 * 키 없으면 완전 스텁. 키 있으면 OpenAPI 스켈레톤 호출.
 */
export class ElevenstAdapter implements ChannelAdapter, ChannelInvoiceAdapter {
  readonly channel = Channel.ELEVENST;
  private readonly fetchImpl: typeof fetch;

  constructor(fetchImpl: typeof fetch = fetch) {
    this.fetchImpl = fetchImpl;
  }

  private baseUrl(): string {
    return (
      process.env.ELEVENST_API_URL?.trim() ||
      process.env.ELEVENST_OPENAPI_URL?.trim() ||
      "https://api.11st.co.kr"
    ).replace(/\/$/, "");
  }

  async publish(payload: ChannelProductPayload): Promise<PublishResult> {
    if (!isElevenstConfigured()) {
      return {
        success: true,
        externalProductId: `11ST-STUB-${payload.externalId}`,
        message: "11번가 스텁 등록 완료 (API 키 미설정 — 실제 전송 없음)",
        payload,
        mode: "stub",
      };
    }
    return {
      success: false,
      message:
        "11번가 상품 등록 live 스켈레톤만 준비됨 — 카테고리/고시 매핑 후 활성화",
      payload,
      mode: "live",
    };
  }

  async syncPriceStock(payload: ChannelProductPayload): Promise<SyncResult> {
    if (!isElevenstConfigured()) {
      return {
        success: true,
        message: "11번가 가격/재고 스텁 동기화",
        salePriceKrw: payload.salePriceKrw,
        inStock: payload.inStock,
        mode: "stub",
      };
    }
    return {
      success: false,
      message: "11번가 가격/재고 live 미구현",
      mode: "live",
    };
  }

  async registerInvoice(
    req: ChannelInvoiceRequest,
  ): Promise<ChannelInvoiceResult> {
    if (!isElevenstConfigured()) {
      return {
        success: true,
        mode: "stub",
        status: "STUBBED",
        message: "11번가 송장 등록 스텁 (API 키 미설정)",
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
        message: "11번가 송장 등록: orderExternalId 필요",
      };
    }

    try {
      const key = process.env.ELEVENST_API_KEY!.trim();
      // OpenAPI 발송처리 스켈레톤 (공식 경로/필드는 셀러센터 문서에 맞게 교체)
      const path = `/rest/ordservices/reqdelivery/${encodeURIComponent(req.orderExternalId)}`;
      const res = await this.fetchImpl(`${this.baseUrl()}${path}`, {
        method: "POST",
        headers: {
          openapi_key: key,
          "Content-Type": "application/xml;charset=utf-8",
        },
        body: [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<Orders>`,
          `<orderNo>${escapeXml(req.orderExternalId)}</orderNo>`,
          `<dlvNo>${escapeXml(req.localTrackingNo)}</dlvNo>`,
          `<sendDt>${new Date().toISOString().slice(0, 10)}</sendDt>`,
          `<dlvEtprsCd>${escapeXml(mapCarrierToElevenst(req.localCarrier))}</dlvEtprsCd>`,
          `</Orders>`,
        ].join(""),
      });
      const body = await readJsonSafe(res);
      if (!res.ok) {
        return {
          success: false,
          mode: "live",
          status: "FAILED",
          message: errorMessageFromBody(body, `11번가 송장 등록 실패 (${res.status})`),
          payload: { status: res.status, body },
        };
      }
      return {
        success: true,
        mode: "live",
        status: "SUCCEEDED",
        message: "11번가 송장 등록 완료",
        payload: { body },
      };
    } catch (error) {
      return {
        success: false,
        mode: "live",
        status: "FAILED",
        message: error instanceof Error ? error.message : "11번가 송장 등록 예외",
      };
    }
  }
}

function mapCarrierToElevenst(carrier: string): string {
  const c = carrier.toLowerCase();
  if (c.includes("cj")) return "00034";
  if (c.includes("한진")) return "00021";
  if (c.includes("롯데")) return "00011";
  if (c.includes("우체국") || c.includes("post")) return "00001";
  return "00034";
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
