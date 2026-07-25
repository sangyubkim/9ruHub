import { afterEach, describe, expect, it, vi } from "vitest";
import { clearSmartStoreTokenCache } from "./smartstore-auth";
import { SmartStoreAdapter } from "./smartstore";

const basePayload = {
  title: "테스트 상품",
  salePriceKrw: 29900,
  detailHtml: "<p>상세</p>",
  images: ["https://example.com/a.jpg"],
  options: [{ name: "옵션", values: ["기본"] }],
  noticeText: "고시",
  sourceUrl: "https://www.amazon.com/dp/B000",
  externalId: "B000",
  inStock: true,
};

describe("SmartStoreAdapter", () => {
  afterEach(() => {
    clearSmartStoreTokenCache();
    vi.unstubAllEnvs();
  });

  it("키가 없으면 스텁 등록한다", async () => {
    vi.stubEnv("SMARTSTORE_CLIENT_ID", "");
    vi.stubEnv("SMARTSTORE_CLIENT_SECRET", "");
    const adapter = new SmartStoreAdapter();
    const result = await adapter.publish(basePayload);
    expect(result.mode).toBe("stub");
    expect(result.success).toBe(true);
    expect(result.externalProductId).toContain("SS-STUB-");
  });

  it("키가 있으면 OAuth 후 상품 등록 API를 호출한다", async () => {
    vi.stubEnv("SMARTSTORE_CLIENT_ID", "client");
    vi.stubEnv("SMARTSTORE_CLIENT_SECRET", "$2a$10$abcdefghijklmnopqrstuv");
    vi.stubEnv("SMARTSTORE_LEAF_CATEGORY_ID", "50000000");
    vi.stubEnv("SMARTSTORE_SHIPPING_ADDRESS_ID", "1");
    vi.stubEnv("SMARTSTORE_RETURN_ADDRESS_ID", "2");

    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/oauth2/token")) {
        return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), {
          status: 200,
        });
      }
      if (url.endsWith("/v2/products") && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            originProductNo: 111,
            smartstoreChannelProductNo: 222,
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ message: "unexpected" }), { status: 500 });
    }) as unknown as typeof fetch;

    const adapter = new SmartStoreAdapter(fetchImpl);
    const result = await adapter.publish(basePayload);
    expect(result.success).toBe(true);
    expect(result.mode).toBe("live");
    expect(result.externalProductId).toBe("222");
    expect(result.meta?.originProductNo).toBe("111");
    expect(fetchImpl).toHaveBeenCalled();
  });

  it("상품 env 부족 시 실패 메시지를 반환한다", async () => {
    vi.stubEnv("SMARTSTORE_CLIENT_ID", "client");
    vi.stubEnv("SMARTSTORE_CLIENT_SECRET", "$2a$10$abcdefghijklmnopqrstuv");
    vi.stubEnv("SMARTSTORE_LEAF_CATEGORY_ID", "");
    vi.stubEnv("SMARTSTORE_SHIPPING_ADDRESS_ID", "");
    vi.stubEnv("SMARTSTORE_RETURN_ADDRESS_ID", "");

    const adapter = new SmartStoreAdapter(async () => new Response("{}", { status: 200 }));
    const result = await adapter.publish(basePayload);
    expect(result.success).toBe(false);
    expect(result.mode).toBe("live");
    expect(result.message).toContain("env 부족");
  });
});
