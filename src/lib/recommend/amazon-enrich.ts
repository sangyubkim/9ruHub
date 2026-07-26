import type { FetchedProduct } from "@/lib/amazon/fetch-product";
import { fetchNaverCompetitorPrices } from "@/lib/discover/demand/naver-competitors";
import {
  estimateIntlShipping,
  type IntlShippingQuote,
} from "@/lib/forwarder/shipping-estimate";
import {
  calculateSalePrice,
  defaultPriceRuleFromEnv,
  type PriceRuleInput,
} from "@/lib/price-engine";
import { evaluateMarketViability } from "@/lib/pricing/viability";
import { keywordFromAmazonTitle } from "@/lib/recommend/keyword-from-amazon";
import { getTenantPriceRule } from "@/lib/tenant";

export type ShippingDetail = {
  feeKrw: number;
  weightGrams: number;
  billableLbs: number | null;
  totalUsd: number | null;
  provider: string;
  tier: string;
  note: string | null;
  weightSource: "amazon_parse" | "default";
};

export type AmazonPriced = {
  salePriceKrw: number;
  costKrw: number;
  sourcePriceKrw: number;
  intlShippingKrw: number;
  minViableSaleKrw: number;
  weightGrams: number;
  /** 가격 규칙 목표 마진 (MARGIN_RATE / DB) */
  targetMarginRate: number;
  shipping: ShippingDetail;
};

function toShippingDetail(
  quote: IntlShippingQuote,
  weightSource: "amazon_parse" | "default",
): ShippingDetail {
  return {
    feeKrw: quote.feeKrw,
    weightGrams: quote.weightGrams,
    billableLbs: quote.billableLbs ?? null,
    totalUsd: quote.totalUsd ?? null,
    provider: quote.provider,
    tier: quote.tier,
    note: quote.note ?? null,
    weightSource,
  };
}

export type AmazonMarketEnrichment = {
  keyword: string;
  competitorAvgKrw: number | null;
  competitorCount: number;
  marketVerdict: ReturnType<typeof evaluateMarketViability>;
};

async function loadPriceRule(tenantId: string): Promise<PriceRuleInput> {
  const saved = await getTenantPriceRule(tenantId);
  const env = defaultPriceRuleFromEnv();
  if (!saved) return env;
  return {
    usdToKrw: Number(saved.usdToKrw),
    marginRate: Number(saved.marginRate),
    shippingFeeKrw: saved.shippingFeeKrw,
    agencyFeeKrw: saved.agencyFeeKrw,
    platformFeeRate: Number(saved.platformFeeRate),
    dutyRate: Number(saved.dutyRate),
    roundTo: saved.roundTo,
    chinaShippingFeeKrw: env.chinaShippingFeeKrw,
    intlShippingFeeKrw: env.intlShippingFeeKrw,
    cardFeeRate: env.cardFeeRate,
    minMarginRate: env.minMarginRate,
    undercutRate: env.undercutRate,
  };
}

/** Amazon USD + 몰테일 US 배송으로 판매가·원가 산정 */
export async function priceAmazonUsProduct(
  tenantId: string,
  sourcePriceUsd: number,
  weightGrams?: number | null,
): Promise<AmazonPriced> {
  const rule = await loadPriceRule(tenantId);
  const parsedWeight =
    weightGrams != null && Number.isFinite(weightGrams) && weightGrams > 0
      ? weightGrams
      : null;
  const shippingQuote = estimateIntlShipping({
    region: "US",
    weightGrams: parsedWeight,
  });
  const ruleWithMalltail: PriceRuleInput = {
    ...rule,
    chinaShippingFeeKrw: rule.chinaShippingFeeKrw ?? 0,
    intlShippingFeeKrw: shippingQuote.feeKrw,
    shippingFeeKrw: shippingQuote.feeKrw,
  };
  const breakdown = calculateSalePrice(sourcePriceUsd, ruleWithMalltail);
  const costKrw =
    breakdown.sourcePriceKrw +
    breakdown.shippingFeeKrw +
    breakdown.agencyFeeKrw +
    breakdown.dutyKrw;

  return {
    salePriceKrw: breakdown.salePriceKrw,
    costKrw,
    sourcePriceKrw: breakdown.sourcePriceKrw,
    intlShippingKrw: shippingQuote.feeKrw,
    minViableSaleKrw: costKrw,
    weightGrams: shippingQuote.weightGrams,
    targetMarginRate: rule.marginRate,
    shipping: toShippingDetail(
      shippingQuote,
      parsedWeight != null ? "amazon_parse" : "default",
    ),
  };
}

/** 네이버 쇼핑 시세 + 시장성 판정 */
export async function enrichAmazonMarket(
  product: Pick<FetchedProduct, "title" | "brand" | "isFallback">,
  priced: AmazonPriced,
): Promise<AmazonMarketEnrichment> {
  const keyword = product.isFallback
    ? ""
    : keywordFromAmazonTitle(product.title, product.brand);

  let competitorAvgKrw: number | null = null;
  let competitorCount = 0;

  if (keyword) {
    const market = await fetchNaverCompetitorPrices(keyword);
    competitorAvgKrw = market.avg;
    competitorCount = market.prices.length;
  }

  const marketVerdict = evaluateMarketViability({
    minViableSaleKrw: priced.minViableSaleKrw,
    costPlusSaleKrw: priced.salePriceKrw,
    competitorAvgKrw,
  });

  return {
    keyword,
    competitorAvgKrw,
    competitorCount,
    marketVerdict,
  };
}
