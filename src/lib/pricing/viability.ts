/**
 * 시장성 판정: 최소 판매가 vs 경쟁가 천장.
 * minViable ≤ 경쟁평균 × ceiling → 판매
 * 합배송 가정으로만 되면 NEED_CONSOLIDATION
 * 그래도 안 되면 NOT_RECOMMENDED
 */

export type MarketVerdictCode =
  | "SELL"
  | "NEED_CONSOLIDATION"
  | "NOT_RECOMMENDED"
  | "NO_MARKET_DATA";

export type MarketVerdict = {
  code: MarketVerdictCode;
  label: string;
  message: string;
  competitorAvgKrw: number | null;
  marketCeilingKrw: number | null;
  minViableSaleKrw: number;
  costPlusSaleKrw: number;
  consolidatedMinViableKrw: number | null;
  consolidationUnits: number;
  ceilingRate: number;
  ratioToMarket: number | null;
};

export function evaluateMarketViability(input: {
  minViableSaleKrw: number;
  costPlusSaleKrw: number;
  competitorAvgKrw?: number | null;
  /** 경쟁 평균 대비 허용 상한 배수 (기본 1.15) */
  ceilingRate?: number;
  /** 합배송 가정 수량 */
  consolidationUnits?: number;
  /** 합배송 시 쓸 최소 판매가 (intl/N 반영). 없으면 합배송 분기 생략 */
  consolidatedMinViableKrw?: number | null;
}): MarketVerdict {
  const ceilingRate = input.ceilingRate ?? Number(process.env.MARKET_CEILING_RATE ?? 1.15);
  const consolidationUnits = Math.max(
    2,
    input.consolidationUnits ??
      Number(process.env.SHIPPING_CONSOLIDATION_UNITS ?? 5),
  );
  const competitorAvg =
    input.competitorAvgKrw != null &&
    Number.isFinite(input.competitorAvgKrw) &&
    input.competitorAvgKrw > 0
      ? Math.round(input.competitorAvgKrw)
      : null;

  if (competitorAvg == null) {
    return {
      code: "NO_MARKET_DATA",
      label: "시장가 없음",
      message:
        "네이버 등 경쟁가가 없어 판매 가능 여부를 판정하지 못했습니다. 경쟁가를 입력하거나 키워드 시세를 수집하세요.",
      competitorAvgKrw: null,
      marketCeilingKrw: null,
      minViableSaleKrw: input.minViableSaleKrw,
      costPlusSaleKrw: input.costPlusSaleKrw,
      consolidatedMinViableKrw: input.consolidatedMinViableKrw ?? null,
      consolidationUnits,
      ceilingRate,
      ratioToMarket: null,
    };
  }

  const marketCeilingKrw = Math.round(competitorAvg * ceilingRate);
  const ratioToMarket =
    Math.round((input.minViableSaleKrw / competitorAvg) * 100) / 100;

  if (input.minViableSaleKrw <= marketCeilingKrw) {
    return {
      code: "SELL",
      label: "판매 가능",
      message: `최소 판매가 ${input.minViableSaleKrw.toLocaleString("ko-KR")}원이 경쟁 평균 ${competitorAvg.toLocaleString("ko-KR")}원 × ${ceilingRate}(= ${marketCeilingKrw.toLocaleString("ko-KR")}원) 이하입니다.`,
      competitorAvgKrw: competitorAvg,
      marketCeilingKrw,
      minViableSaleKrw: input.minViableSaleKrw,
      costPlusSaleKrw: input.costPlusSaleKrw,
      consolidatedMinViableKrw: input.consolidatedMinViableKrw ?? null,
      consolidationUnits,
      ceilingRate,
      ratioToMarket,
    };
  }

  const consolidated = input.consolidatedMinViableKrw;
  if (
    consolidated != null &&
    Number.isFinite(consolidated) &&
    consolidated > 0 &&
    consolidated <= marketCeilingKrw
  ) {
    return {
      code: "NEED_CONSOLIDATION",
      label: "합배송 필요",
      message: `단독 배송 최소가 ${input.minViableSaleKrw.toLocaleString("ko-KR")}원은 시장 천장(${marketCeilingKrw.toLocaleString("ko-KR")}원)을 초과합니다. ${consolidationUnits}건 합배송 가정 최소가 ${consolidated.toLocaleString("ko-KR")}원이면 판매를 검토할 수 있습니다.`,
      competitorAvgKrw: competitorAvg,
      marketCeilingKrw,
      minViableSaleKrw: input.minViableSaleKrw,
      costPlusSaleKrw: input.costPlusSaleKrw,
      consolidatedMinViableKrw: consolidated,
      consolidationUnits,
      ceilingRate,
      ratioToMarket,
    };
  }

  return {
    code: "NOT_RECOMMENDED",
    label: "판매 비추천",
    message: `최소 판매가 ${input.minViableSaleKrw.toLocaleString("ko-KR")}원이 경쟁 평균 ${competitorAvg.toLocaleString("ko-KR")}원 대비 ${(ratioToMarket * 100).toFixed(0)}% 수준(허용 ${(ceilingRate * 100).toFixed(0)}%까지)이라 시장성이 낮습니다. 광고 집행 시 손실 위험이 큽니다.`,
    competitorAvgKrw: competitorAvg,
    marketCeilingKrw,
    minViableSaleKrw: input.minViableSaleKrw,
    costPlusSaleKrw: input.costPlusSaleKrw,
    consolidatedMinViableKrw: consolidated ?? null,
    consolidationUnits,
    ceilingRate,
    ratioToMarket,
  };
}

/** 합배송 가정: 국제배송만 units로 나눈 뒤 최소 판매가 재계산에 쓸 landed 구성용 */
export function splitIntlShipping(
  intlShippingKrw: number,
  units: number,
): number {
  const n = Math.max(1, units);
  return Math.round(intlShippingKrw / n);
}
