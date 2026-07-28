type Verdict = {
  code: string;
  label: string;
  message: string;
  competitorAvgKrw?: number | null;
  marketCeilingKrw?: number | null;
  minViableSaleKrw?: number;
  consolidatedMinViableKrw?: number | null;
  consolidationUnits?: number;
};

const STYLES: Record<string, string> = {
  SELL: "border-emerald-200 bg-emerald-50 text-emerald-950",
  NEED_CONSOLIDATION: "border-amber-200 bg-amber-50 text-amber-950",
  NOT_RECOMMENDED: "border-red-200 bg-red-50 text-red-950",
  NO_MARKET_DATA: "border-zinc-200 bg-zinc-50 text-zinc-800",
};

export function MarketVerdictBanner({
  verdict,
}: {
  verdict: Verdict | null | undefined;
}) {
  if (!verdict?.code) return null;
  const style = STYLES[verdict.code] ?? STYLES.NO_MARKET_DATA;

  return (
    <div className={`rounded-xl border px-4 py-3.5 text-base ${style}`}>
      <p className="font-semibold">
        시장성: {verdict.label}
        <span className="ml-2 text-sm font-normal opacity-70">
          {verdict.code}
        </span>
      </p>
      <p className="mt-1 text-sm leading-relaxed opacity-90">{verdict.message}</p>
      {verdict.competitorAvgKrw != null ? (
        <p className="mt-2 text-sm opacity-80">
          경쟁평균 {verdict.competitorAvgKrw.toLocaleString("ko-KR")}원
          {verdict.marketCeilingKrw != null
            ? ` · 천장 ${verdict.marketCeilingKrw.toLocaleString("ko-KR")}원`
            : ""}
          {verdict.minViableSaleKrw != null
            ? ` · 최소가 ${verdict.minViableSaleKrw.toLocaleString("ko-KR")}원`
            : ""}
          {verdict.consolidatedMinViableKrw != null
            ? ` · 합배송(${verdict.consolidationUnits ?? "?"}건) 최소 ${verdict.consolidatedMinViableKrw.toLocaleString("ko-KR")}원`
            : ""}
        </p>
      ) : null}
    </div>
  );
}
