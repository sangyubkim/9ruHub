import { fetchNaverCompetitorPrices } from "@/lib/discover/demand/naver-competitors";
import { estimateIntlShipping } from "@/lib/forwarder/shipping-estimate";
import { defaultPriceRuleFromEnv } from "@/lib/price-engine";
import { recommendSalePrice } from "@/lib/pricing/recommend";
import type { MarketVerdict } from "@/lib/pricing/viability";

export type DiscoverMarketAssessment = {
  marketVerdict: MarketVerdict;
  minViableSaleKrw: number;
  recommendedSalePriceKrw: number;
  costPlusSaleKrw: number;
  competitorAvgKrw: number | null;
  competitorCount: number;
  intlShippingKrw: number;
  sourceCostKrw: number;
};

/**
 * 발굴 오퍼 1건의 시장성: 네이버 실시세 + cost-plus 최소가.
 * competitorPrices를 넘기면 키워드당 1회만 쇼핑검색하면 된다.
 */
export async function assessDiscoverOfferMarket(options: {
  keyword: string;
  costPriceCny: number;
  weightGrams?: number | null;
  competitorPrices?: number[];
}): Promise<DiscoverMarketAssessment> {
  const envRule = defaultPriceRuleFromEnv();
  const cnyToKrw = Number(process.env.CNY_TO_KRW ?? 190);
  const shippingQuote = estimateIntlShipping({
    region: "CN",
    weightGrams: options.weightGrams,
  });

  let prices = options.competitorPrices;
  if (prices == null) {
    const market = await fetchNaverCompetitorPrices(options.keyword);
    prices = market.prices;
  }

  const priced = recommendSalePrice({
    cost: options.costPriceCny,
    currency: "CNY",
    cnyToKrw,
    chinaShipping: envRule.chinaShippingFeeKrw ?? 0,
    intlShipping: shippingQuote.feeKrw,
    dutyRate: envRule.dutyRate,
    cardFeeRate: envRule.cardFeeRate ?? 0.025,
    platformFeeRate: envRule.platformFeeRate,
    agencyFee: envRule.agencyFeeKrw,
    marginRate: envRule.marginRate,
    minMarginRate: envRule.minMarginRate,
    undercutRate: envRule.undercutRate,
    roundTo: envRule.roundTo,
    competitors: prices.length > 0 ? prices : undefined,
  });

  return {
    marketVerdict: priced.marketVerdict,
    minViableSaleKrw: priced.minViableSaleKrw,
    recommendedSalePriceKrw: priced.recommendedSalePriceKrw,
    costPlusSaleKrw: priced.costPlusSaleKrw,
    competitorAvgKrw: priced.competitors?.avg ?? null,
    competitorCount: priced.competitors?.count ?? 0,
    intlShippingKrw: priced.intlShippingKrw,
    sourceCostKrw: priced.sourceCostKrw,
  };
}
