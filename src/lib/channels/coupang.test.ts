import { afterEach, describe, expect, it, vi } from "vitest";
import { CoupangAdapter } from "./coupang";

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

function stubProductEnv() {
  vi.stubEnv("COUPANG_ACCESS_KEY", "ak");
  vi.stubEnv("COUPANG_SECRET_KEY", "sk");
  vi.stubEnv("COUPANG_VENDOR_ID", "A00012345");
  vi.stubEnv("COUPANG_DISPLAY_CATEGORY_CODE", "56137");
  vi.stubEnv("COUPANG_OUTBOUND_SHIPPING_PLACE_CODE", "74010");
  vi.stubEnv("COUPANG_RETURN_CENTER_CODE", "1000274592");
  vi.stubEnv("COUPANG_RETURN_CHARGE_NAME", "반품지");
  vi.stubEnv("COUPANG_COMPANY_CONTACT_NUMBER", "02-1234-5678");
  vi.stubEnv("COUPANG_VENDOR_USER_ID", "vendoruser");
}

describe("CoupangAdapter", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("키가 없으면 스텁 등록한다", async () => {
    vi.stubEnv("COUPANG_ACCESS_KEY", "");
    vi.stubEnv("COUPANG_SECRET_KEY", "");
    vi.stubEnv("COUPANG_VENDOR_ID", "");
    const adapter = new CoupangAdapter();
    const result = await adapter.publish(basePayload);
    expect(result.mode).toBe("stub");
    expect(result.externalProductId).toContain("CP-STUB-");
  });

  it("키가 있으면 HMAC 헤더와 함께 상품 생성 API를 호출한다", async () => {
    stubProductEnv();

    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
      expect(auth).toContain("CEA algorithm=HmacSHA256");

      if (url.includes("/seller-products") && init?.method === "POST") {
        return new Response(JSON.stringify({ code: "SUCCESS", data: 98765 }), {
          status: 200,
        });
      }
      if (url.includes("/seller-products/98765") && init?.method === "GET") {
        return new Response(
          JSON.stringify({ data: { items: [{ vendorItemId: 555 }] } }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ message: "unexpected" }), { status: 500 });
    }) as unknown as typeof fetch;

    const adapter = new CoupangAdapter(fetchImpl);
    const result = await adapter.publish(basePayload);
    expect(result.success).toBe(true);
    expect(result.mode).toBe("live");
    expect(result.externalProductId).toBe("98765");
    expect(result.meta?.vendorItemId).toBe("555");
  });

  it("동기화 시 가격/수량 API를 호출한다", async () => {
    stubProductEnv();
    const called: string[] = [];

    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      called.push(`${init?.method ?? "GET"} ${url}`);
      if (url.includes("/prices/")) {
        return new Response(JSON.stringify({ code: "SUCCESS" }), { status: 200 });
      }
      if (url.includes("/quantities/")) {
        return new Response(JSON.stringify({ code: "SUCCESS" }), { status: 200 });
      }
      if (url.includes("/sales/")) {
        return new Response(JSON.stringify({ code: "SUCCESS" }), { status: 200 });
      }
      return new Response(JSON.stringify({ message: "unexpected" }), { status: 500 });
    }) as unknown as typeof fetch;

    const adapter = new CoupangAdapter(fetchImpl);
    const result = await adapter.syncPriceStock({
      ...basePayload,
      externalProductId: "98765",
      meta: { vendorItemId: "555", sellerProductId: "98765" },
    });

    expect(result.success).toBe(true);
    expect(result.mode).toBe("live");
    expect(called.some((c) => c.includes("/prices/29900"))).toBe(true);
    expect(called.some((c) => c.includes("/quantities/"))).toBe(true);
  });
});
