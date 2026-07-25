import {
  clearSmartStoreTokenCache,
  fetchSmartStoreAccessToken,
} from "./smartstore-auth";
import {
  buildSmartStoreCreateBody,
  extractSmartStoreIds,
} from "./smartstore-payload";
import { isSmartStoreConfigured } from "./credentials";
import { ChannelApiError, errorMessageFromBody, readJsonSafe } from "./http";
import type {
  ChannelAdapter,
  ChannelProductPayload,
  PublishResult,
  SyncResult,
} from "./types";

const BASE = "https://api.commerce.naver.com/external";

async function smartStoreRequest(
  path: string,
  init: RequestInit,
  fetchImpl: typeof fetch = fetch,
  retried = false,
): Promise<{ status: number; body: unknown }> {
  const token = await fetchSmartStoreAccessToken(fetchImpl);
  const res = await fetchImpl(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = await readJsonSafe(res);

  if (res.status === 401 && !retried) {
    const code = (body as { code?: string } | null)?.code;
    if (code === "GW.AUTHN" || !code) {
      clearSmartStoreTokenCache();
      return smartStoreRequest(path, init, fetchImpl, true);
    }
  }

  return { status: res.status, body };
}

export class SmartStoreAdapter implements ChannelAdapter {
  readonly channel = "SMARTSTORE" as const;
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

  async publish(payload: ChannelProductPayload): Promise<PublishResult> {
    const normalized = this.toPayload(payload);

    if (!isSmartStoreConfigured()) {
      return {
        success: true,
        externalProductId: `SS-STUB-${normalized.externalId}`,
        message: "스마트스토어 스텁 등록 완료 (API 키 미설정 — 실제 전송 없음)",
        payload: normalized,
        mode: "stub",
      };
    }

    try {
      const createBody = buildSmartStoreCreateBody(normalized);
      const originNo = normalized.meta?.originProductNo;
      const channelNo =
        normalized.externalProductId || normalized.meta?.channelProductNo;

      let status: number;
      let body: unknown;

      if (originNo) {
        ({ status, body } = await smartStoreRequest(
          `/v2/products/origin-products/${originNo}`,
          { method: "PUT", body: JSON.stringify(createBody.originProduct) },
          this.fetchImpl,
        ));
      } else if (channelNo && !channelNo.startsWith("SS-STUB-")) {
        ({ status, body } = await smartStoreRequest(
          `/v2/products/channel-products/${channelNo}`,
          { method: "PUT", body: JSON.stringify(createBody) },
          this.fetchImpl,
        ));
      } else {
        ({ status, body } = await smartStoreRequest(
          "/v2/products",
          { method: "POST", body: JSON.stringify(createBody) },
          this.fetchImpl,
        ));
      }

      if (status < 200 || status >= 300) {
        return {
          success: false,
          message: errorMessageFromBody(body, `스마트스토어 등록 실패 (${status})`),
          payload: normalized,
          mode: "live",
        };
      }

      const ids = extractSmartStoreIds(body);
      const externalProductId =
        ids.channelProductNo ||
        channelNo ||
        ids.originProductNo ||
        `SS-${normalized.externalId}`;

      return {
        success: true,
        externalProductId,
        message: originNo || channelNo
          ? "스마트스토어 상품 수정 완료"
          : "스마트스토어 상품 등록 완료",
        payload: normalized,
        mode: "live",
        meta: {
          originProductNo: ids.originProductNo || originNo,
          channelProductNo: ids.channelProductNo || channelNo,
        },
      };
    } catch (error) {
      const message =
        error instanceof ChannelApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "스마트스토어 등록 실패";
      return {
        success: false,
        message,
        payload: normalized,
        mode: "live",
      };
    }
  }

  async syncPriceStock(payload: ChannelProductPayload): Promise<SyncResult> {
    const normalized = this.toPayload(payload);

    if (!isSmartStoreConfigured()) {
      return {
        success: true,
        message: "스마트스토어 가격/재고 동기화 스텁 완료",
        salePriceKrw: normalized.salePriceKrw,
        inStock: normalized.inStock,
        mode: "stub",
      };
    }

    const originNo = normalized.meta?.originProductNo;
    const channelNo =
      normalized.externalProductId || normalized.meta?.channelProductNo;

    if (!originNo && !channelNo) {
      return {
        success: false,
        message: "스마트스토어 외부 상품 ID가 없어 동기화할 수 없습니다.",
        mode: "live",
      };
    }

    try {
      const stockQuantity = normalized.inStock
        ? Number(process.env.SMARTSTORE_DEFAULT_STOCK ?? "999")
        : 0;

      if (originNo) {
        const getRes = await smartStoreRequest(
          `/v2/products/origin-products/${originNo}`,
          { method: "GET" },
          this.fetchImpl,
        );
        if (getRes.status < 200 || getRes.status >= 300) {
          return {
            success: false,
            message: errorMessageFromBody(
              getRes.body,
              `원상품 조회 실패 (${getRes.status})`,
            ),
            mode: "live",
          };
        }

        const current =
          (getRes.body as { originProduct?: Record<string, unknown> })
            ?.originProduct ?? (getRes.body as Record<string, unknown>);
        const updated = {
          ...current,
          salePrice: normalized.salePriceKrw,
          stockQuantity,
        };

        const putRes = await smartStoreRequest(
          `/v2/products/origin-products/${originNo}`,
          { method: "PUT", body: JSON.stringify(updated) },
          this.fetchImpl,
        );
        if (putRes.status < 200 || putRes.status >= 300) {
          return {
            success: false,
            message: errorMessageFromBody(
              putRes.body,
              `원상품 가격/재고 수정 실패 (${putRes.status})`,
            ),
            mode: "live",
          };
        }
      } else if (channelNo) {
        const putRes = await smartStoreRequest(
          `/v2/products/channel-products/${channelNo}`,
          {
            method: "PUT",
            body: JSON.stringify({
              originProduct: {
                salePrice: normalized.salePriceKrw,
                stockQuantity,
              },
            }),
          },
          this.fetchImpl,
        );
        if (putRes.status < 200 || putRes.status >= 300) {
          return {
            success: false,
            message: errorMessageFromBody(
              putRes.body,
              `채널상품 가격/재고 수정 실패 (${putRes.status})`,
            ),
            mode: "live",
          };
        }
      }

      return {
        success: true,
        message: "스마트스토어 가격/재고 동기화 완료",
        salePriceKrw: normalized.salePriceKrw,
        inStock: normalized.inStock,
        mode: "live",
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "스마트스토어 동기화 실패",
        mode: "live",
      };
    }
  }
}
