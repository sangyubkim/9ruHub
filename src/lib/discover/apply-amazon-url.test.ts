import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const upsertSource = vi.fn();
const upsertProduct = vi.fn();
const updateCandidate = vi.fn();
const updateRecommendation = vi.fn();
const fetchAmazonUsProduct = vi.fn();
const priceAmazonUsProduct = vi.fn();
const enrichAmazonMarket = vi.fn();
const generateRecommendCopy = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    aiRecommendation: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      update: (...args: unknown[]) => updateRecommendation(...args),
    },
    sourceProduct: {
      upsert: (...args: unknown[]) => upsertSource(...args),
    },
    product: {
      upsert: (...args: unknown[]) => upsertProduct(...args),
    },
    productCandidate: {
      update: (...args: unknown[]) => updateCandidate(...args),
    },
  },
}));

vi.mock("@/lib/amazon/fetch-product", () => ({
  fetchAmazonUsProduct: (...args: unknown[]) => fetchAmazonUsProduct(...args),
  amazonFallbackReasonMessage: (r?: string) => `fallback:${r ?? "unknown"}`,
}));

vi.mock("@/lib/amazon/ship-eligibility", () => ({
  checkAmazonShipEligibility: vi.fn(async () => ({
    us: { country: "US", status: "ok", confidence: "medium", evidence: "In Stock" },
    kr: {
      country: "KR",
      status: "fail",
      confidence: "medium",
      evidence: "cannot be shipped",
    },
    krDirectShip: false,
    usForwarderOk: true,
    confidence: "medium",
    source: "html",
    checkedAt: "2026-07-28T00:00:00.000Z",
    note: "US ok · KR fail",
  })),
}));

vi.mock("@/lib/recommend/amazon-enrich", () => ({
  priceAmazonUsProduct: (...args: unknown[]) => priceAmazonUsProduct(...args),
  enrichAmazonMarket: (...args: unknown[]) => enrichAmazonMarket(...args),
}));

vi.mock("@/lib/recommend/openai", () => ({
  generateRecommendCopy: (...args: unknown[]) => generateRecommendCopy(...args),
}));

vi.mock("@/lib/draft/detail-template", () => ({
  localizeTitle: (title: string) => `[ko] ${title}`,
}));

describe("applyAmazonUrlToRecommendation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUnique.mockResolvedValue({
      id: "rec-1",
      tenantId: "t1",
      reasonCode: "DEMAND_WATCH",
      scoreBreakdown: {
        features: { needsAmazonUrl: true, naverKeyword: "캠핑 의자" },
      },
      candidate: {
        id: "cand-1",
        keyword: "캠핑 의자",
        rawMetrics: { awaitingAmazon: true },
      },
    });
    fetchAmazonUsProduct.mockResolvedValue({
      asin: "B0TESTASIN",
      sourceUrl: "https://www.amazon.com/dp/B0TESTASIN",
      title: "Camping Chair",
      brand: "BrandX",
      currency: "USD",
      sourcePrice: 29.99,
      inStock: true,
      images: ["https://example.com/a.jpg"],
      options: [],
      weightGrams: 800,
      isFallback: false,
    });
    priceAmazonUsProduct.mockResolvedValue({
      salePriceKrw: 55000,
      costKrw: 40000,
      sourcePriceKrw: 20000,
      productCostKrw: 22000,
      dutyKrw: 1600,
      agencyFeeKrw: 3000,
      intlShippingKrw: 18000,
      minViableSaleKrw: 48000,
      weightGrams: 800,
      targetMarginRate: 0.2,
      platformFeeRate: 0.1,
      cardFeeRate: 0.025,
      minMarginRate: 0.05,
      undercutRate: 0.02,
      roundTo: 100,
      shipping: {
        feeKrw: 18000,
        weightGrams: 800,
        billableLbs: 2,
        totalUsd: 13,
        provider: "malltail",
        tier: "general",
        note: null,
        weightSource: "amazon_parse",
      },
    });
    enrichAmazonMarket.mockResolvedValue({
      competitorAvgKrw: 59000,
      competitorSamples: [],
      marketVerdict: { code: "SELL", label: "판매가능", message: "ok" },
      keyword: "캠핑 의자",
      shopTotal: 120,
      uniqueMallCount: 3,
      sameLikelyCount: 2,
      competitorPrices: [55000, 59000, 61000],
    });
    upsertSource.mockResolvedValue({ id: "sp-1" });
    upsertProduct.mockResolvedValue({
      id: "prod-1",
      title: "Camping Chair",
      titleKo: "[ko] Camping Chair",
      brand: "BrandX",
      sourceUrl: "https://www.amazon.com/dp/B0TESTASIN",
      sourcePrice: 29.99,
      inStock: true,
      images: ["https://example.com/a.jpg"],
      totalSold: 0,
      externalId: "B0TESTASIN",
    });
    updateCandidate.mockResolvedValue({});
    updateRecommendation.mockResolvedValue({
      id: "rec-1",
      productId: "prod-1",
    });
    generateRecommendCopy.mockResolvedValue({
      reasonText: "수요 대비 마진 양호",
      detailHtml: "<p>ok</p>",
      usedGpt: false,
    });
  });

  it("Amazon URL을 붙여 product 연결·needsAmazonUrl 해제를 한다", async () => {
    const { applyAmazonUrlToRecommendation } = await import(
      "@/lib/discover/apply-amazon-url"
    );

    const result = await applyAmazonUrlToRecommendation("rec-1", {
      url: "https://www.amazon.com/dp/B0TESTASIN",
    });

    expect(fetchAmazonUsProduct).toHaveBeenCalled();
    expect(updateCandidate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "cand-1" },
        data: expect.objectContaining({
          isStub: false,
          supplyUrl: "https://www.amazon.com/dp/B0TESTASIN",
          externalSupplyId: "B0TESTASIN",
        }),
      }),
    );
    expect(updateRecommendation).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rec-1" },
        data: expect.objectContaining({
          productId: "prod-1",
          externalId: "B0TESTASIN",
        }),
      }),
    );
    const scoreBreakdown = updateRecommendation.mock.calls[0]![0].data
      .scoreBreakdown as string | Record<string, unknown>;
    const parsed =
      typeof scoreBreakdown === "string"
        ? (JSON.parse(scoreBreakdown) as {
            features?: { needsAmazonUrl?: boolean };
          })
        : (scoreBreakdown as { features?: { needsAmazonUrl?: boolean } });
    expect(parsed.features?.needsAmazonUrl).toBe(false);
    expect(
      (parsed.features as { krDirectShip?: boolean | null } | undefined)
        ?.krDirectShip,
    ).toBe(false);
    expect(result.isFallback).toBe(false);
    expect(result.fetched.asin).toBe("B0TESTASIN");
  });

  it("폴백 + 수동 USD면 실가로 간주한다", async () => {
    fetchAmazonUsProduct.mockResolvedValue({
      asin: "B0FALLBACK",
      sourceUrl: "https://www.amazon.com/dp/B0FALLBACK",
      title: "[Amazon US] B0FALLBACK",
      brand: null,
      currency: "USD",
      sourcePrice: 29.99,
      inStock: true,
      images: [],
      options: [],
      isFallback: true,
      raw: { reason: "amazon_robot_block" },
    });

    const { applyAmazonUrlToRecommendation } = await import(
      "@/lib/discover/apply-amazon-url"
    );

    await applyAmazonUrlToRecommendation("rec-1", {
      url: "B0FALLBACK",
      costUsd: 19.5,
    });

    expect(priceAmazonUsProduct).toHaveBeenCalledWith("t1", 19.5, undefined);
    expect(updateRecommendation).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reasonCode: expect.not.stringMatching(/^FALLBACK$/),
        }),
      }),
    );
  });

  it("일반 추천 카드는 거부한다", async () => {
    findUnique.mockResolvedValue({
      id: "rec-2",
      tenantId: "t1",
      reasonCode: "STRONG_BUY",
      scoreBreakdown: { features: { needsAmazonUrl: false, isFallback: false } },
      candidate: null,
      sourceUrl: "https://www.amazon.com/dp/B0OK",
    });

    const { applyAmazonUrlToRecommendation } = await import(
      "@/lib/discover/apply-amazon-url"
    );

    await expect(
      applyAmazonUrlToRecommendation("rec-2", {
        url: "https://www.amazon.com/dp/B0X",
      }),
    ).rejects.toThrow(/수요 대기 또는 가격 폴백/);
  });

  it("FALLBACK 카드는 기존 URL + 수동 USD로 재적용한다", async () => {
    findUnique.mockResolvedValue({
      id: "rec-fb",
      tenantId: "t1",
      reasonCode: "FALLBACK",
      sourceUrl: "https://www.amazon.com/dp/B0BR3LBSMB",
      externalId: "B0BR3LBSMB",
      scoreBreakdown: {
        features: { isFallback: true, needsAmazonUrl: false },
      },
      candidate: {
        id: "cand-fb",
        keyword: "손선풍기",
        rawMetrics: {},
      },
    });
    fetchAmazonUsProduct.mockResolvedValue({
      asin: "B0BR3LBSMB",
      sourceUrl: "https://www.amazon.com/dp/B0BR3LBSMB",
      title: "[초안] Amazon US B0BR3LBSMB",
      brand: null,
      currency: "USD",
      sourcePrice: 29.99,
      inStock: true,
      images: [],
      options: [],
      isFallback: true,
      raw: { reason: "amazon_robot_block" },
    });

    const { applyAmazonUrlToRecommendation } = await import(
      "@/lib/discover/apply-amazon-url"
    );

    await expect(
      applyAmazonUrlToRecommendation("rec-fb", {}),
    ).rejects.toThrow(/실가\(USD\)/);

    const result = await applyAmazonUrlToRecommendation("rec-fb", {
      costUsd: 41.98,
      weightGrams: 850,
    });

    expect(fetchAmazonUsProduct).toHaveBeenCalledWith(
      "https://www.amazon.com/dp/B0BR3LBSMB",
    );
    expect(priceAmazonUsProduct).toHaveBeenCalledWith("t1", 41.98, 850);
    expect(result.isFallback).toBe(false);
    expect(result.fetched.weightGrams).toBe(850);
  });
});
