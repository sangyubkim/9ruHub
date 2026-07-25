import { createCoupangAuthorization } from "./coupang-hmac";
import {
  buildCoupangCreateBody,
  extractCoupangSellerProductId,
  extractCoupangVendorItemId,
} from "./coupang-payload";
import { isCoupangConfigured } from "./credentials";
import { ChannelApiError, errorMessageFromBody, readJsonSafe } from "./http";
import type {
  ChannelAdapter,
  ChannelProductPayload,
  PublishResult,
  SyncResult,
} from "./types";

const HOST = "https://api-gateway.coupang.com";

async function coupangRequest(
  method: string,
  pathWithQuery: string,
  body?: unknown,
  fetchImpl: typeof fetch = fetch,
): Promise<{ status: number; body: unknown }> {
  const accessKey = process.env.COUPANG_ACCESS_KEY?.trim();
  const secretKey = process.env.COUPANG_SECRET_KEY?.trim();
  if (!accessKey || !secretKey) {
    throw new Error("COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY 이 필요합니다.");
  }

  const { authorization } = createCoupangAuthorization({
    method,
    pathWithQuery,
    accessKey,
    secretKey,
  });

  const res = await fetchImpl(`${HOST}${pathWithQuery}`, {
    method,
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json;charset=UTF-8",
      "X-EXTENDED-TIMEOUT": "90000",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await readJsonSafe(res);
  return { status: res.status, body: json };
}

export class CoupangAdapter implements ChannelAdapter {
  readonly channel = "COUPANG" as const;
  private readonly fetchImpl: typeof fetch;

  constructor(fetchImpl: typeof fetch = fetch) {
    this.fetchImpl = fetchImpl;
  }

  toPayload(input: ChannelProductPayload): ChannelProductPayload {
    return {
      ...input,
      title: input.title.slice(0, 100),
    };
  }

  private async resolveVendorItemId(
    sellerProductId: string,
    known?: string,
  ): Promise<string | undefined> {
    if (known) return known;
    const path = `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/${sellerProductId}`;
    const { status, body } = await coupangRequest("GET", path, undefined, this.fetchImpl);
    if (status < 200 || status >= 300) {
      throw new ChannelApiError(
        errorMessageFromBody(body, `쿠팡 상품 조회 실패 (${status})`),
        status,
        body,
      );
    }
    return extractCoupangVendorItemId(body);
  }

  async publish(payload: ChannelProductPayload): Promise<PublishResult> {
    const normalized = this.toPayload(payload);

    if (!isCoupangConfigured()) {
      return {
        success: true,
        externalProductId: `CP-STUB-${normalized.externalId}`,
        message: "쿠팡 스텁 등록 완료 (API 키 미설정 — 실제 전송 없음)",
        payload: normalized,
        mode: "stub",
      };
    }

    try {
      const existingId =
        normalized.externalProductId || normalized.meta?.sellerProductId;
      const createPath = "/v2/providers/seller_api/apis/api/v1/marketplace/seller-products";
      const createBody = buildCoupangCreateBody(normalized);

      let status: number;
      let body: unknown;

      if (existingId && !existingId.startsWith("CP-STUB-")) {
        ({ status, body } = await coupangRequest(
          "PUT",
          createPath,
          { ...createBody, sellerProductId: Number(existingId) },
          this.fetchImpl,
        ));
      } else {
        ({ status, body } = await coupangRequest(
          "POST",
          createPath,
          createBody,
          this.fetchImpl,
        ));
      }

      if (status < 200 || status >= 300) {
        return {
          success: false,
          message: errorMessageFromBody(body, `쿠팡 등록 실패 (${status})`),
          payload: normalized,
          mode: "live",
        };
      }

      const sellerProductId =
        extractCoupangSellerProductId(body) || existingId || `CP-${normalized.externalId}`;
      let vendorItemId = normalized.meta?.vendorItemId;
      try {
        vendorItemId = await this.resolveVendorItemId(sellerProductId, vendorItemId);
      } catch {
        // 등록 직후 조회 지연 가능 — sellerProductId만 저장
      }

      return {
        success: true,
        externalProductId: sellerProductId,
        message: existingId ? "쿠팡 상품 수정 완료" : "쿠팡 상품 등록 완료",
        payload: normalized,
        mode: "live",
        meta: {
          sellerProductId,
          vendorItemId,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "쿠팡 등록 실패",
        payload: normalized,
        mode: "live",
      };
    }
  }

  async syncPriceStock(payload: ChannelProductPayload): Promise<SyncResult> {
    const normalized = this.toPayload(payload);

    if (!isCoupangConfigured()) {
      return {
        success: true,
        message: "쿠팡 가격/재고 동기화 스텁 완료",
        salePriceKrw: normalized.salePriceKrw,
        inStock: normalized.inStock,
        mode: "stub",
      };
    }

    const sellerProductId =
      normalized.externalProductId || normalized.meta?.sellerProductId;
    if (!sellerProductId || sellerProductId.startsWith("CP-STUB-")) {
      return {
        success: false,
        message: "쿠팡 외부 상품 ID가 없어 동기화할 수 없습니다.",
        mode: "live",
      };
    }

    try {
      const vendorItemId = await this.resolveVendorItemId(
        sellerProductId,
        normalized.meta?.vendorItemId,
      );
      if (!vendorItemId) {
        return {
          success: false,
          message: "쿠팡 vendorItemId 를 찾지 못해 동기화할 수 없습니다.",
          mode: "live",
        };
      }

      const pricePath = `/v2/providers/seller_api/apis/api/v1/marketplace/vendor-items/${vendorItemId}/prices/${normalized.salePriceKrw}`;
      const priceRes = await coupangRequest("PUT", pricePath, undefined, this.fetchImpl);
      if (priceRes.status < 200 || priceRes.status >= 300) {
        return {
          success: false,
          message: errorMessageFromBody(
            priceRes.body,
            `쿠팡 가격 변경 실패 (${priceRes.status})`,
          ),
          mode: "live",
        };
      }

      const qty = normalized.inStock
        ? Number(process.env.COUPANG_DEFAULT_QUANTITY ?? "100")
        : 0;
      const qtyPath = `/v2/providers/seller_api/apis/api/v1/marketplace/vendor-items/${vendorItemId}/quantities/${qty}`;
      const qtyRes = await coupangRequest("PUT", qtyPath, undefined, this.fetchImpl);
      if (qtyRes.status < 200 || qtyRes.status >= 300) {
        return {
          success: false,
          message: errorMessageFromBody(
            qtyRes.body,
            `쿠팡 재고 변경 실패 (${qtyRes.status})`,
          ),
          mode: "live",
        };
      }

      if (!normalized.inStock) {
        const stopPath = `/v2/providers/seller_api/apis/api/v1/marketplace/vendor-items/${vendorItemId}/sales/stop`;
        await coupangRequest("PUT", stopPath, undefined, this.fetchImpl);
      } else {
        const resumePath = `/v2/providers/seller_api/apis/api/v1/marketplace/vendor-items/${vendorItemId}/sales/resume`;
        await coupangRequest("PUT", resumePath, undefined, this.fetchImpl);
      }

      return {
        success: true,
        message: "쿠팡 가격/재고 동기화 완료",
        salePriceKrw: normalized.salePriceKrw,
        inStock: normalized.inStock,
        mode: "live",
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "쿠팡 동기화 실패",
        mode: "live",
      };
    }
  }
}
