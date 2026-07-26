import { MarketVerdictBanner } from "@/app/pricing/MarketVerdictBanner";

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

const VERDICT_PILL: Record<string, string> = {
  SELL: "bg-emerald-600 text-white",
  NEED_CONSOLIDATION: "bg-amber-500 text-white",
  NOT_RECOMMENDED: "bg-red-600 text-white",
  NO_MARKET_DATA: "bg-zinc-500 text-white",
};

const LABEL_PILL: Record<string, string> = {
  STRONG_BUY: "bg-sky-800 text-white",
  BUY: "bg-sky-600 text-white",
  WATCH: "bg-zinc-600 text-white",
  PASS: "bg-zinc-400 text-white",
  SKIP: "bg-zinc-400 text-white",
  FALLBACK: "bg-red-700 text-white",
};

export function RecommendEconomics({
  score,
  reasonCode,
  isStub,
  isFallback,
  costCny,
  costUsd,
  sellKrw,
  minViableKrw,
  competitorAvgKrw,
  sourceCostKrw,
  intlShippingKrw,
  marginRate,
  searchVolume,
  marketVerdict,
}: {
  score: number;
  reasonCode?: string | null;
  isStub?: boolean;
  /** Amazon 파싱 실패 — $29.99 임시값 */
  isFallback?: boolean;
  costCny?: number | null;
  /** Amazon 경로 원가(USD). CNY가 없을 때 원가 칸에 표시 */
  costUsd?: number | null;
  sellKrw?: number | null;
  minViableKrw?: number | null;
  competitorAvgKrw?: number | null;
  sourceCostKrw?: number | null;
  intlShippingKrw?: number | null;
  marginRate?: number | null;
  searchVolume?: number | null;
  marketVerdict?: Verdict | null;
}) {
  const verdictCode = marketVerdict?.code;
  const label = reasonCode ?? "—";
  const fallback = Boolean(isFallback || reasonCode === "FALLBACK");

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-md px-2.5 py-1 text-xs font-semibold ${LABEL_PILL[label] ?? "bg-zinc-200 text-zinc-800"}`}
        >
          {label} · {score.toFixed(1)}점
        </span>
        {verdictCode ? (
          <span
            className={`rounded-md px-2.5 py-1 text-xs font-semibold ${VERDICT_PILL[verdictCode] ?? VERDICT_PILL.NO_MARKET_DATA}`}
          >
            시장성 {marketVerdict?.label ?? verdictCode}
          </span>
        ) : null}
        {fallback ? (
          <span className="rounded-md bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-900">
            가격 미확인(폴백)
          </span>
        ) : null}
        {isStub ? (
          <span className="rounded-md bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-900">
            STUB
          </span>
        ) : null}
      </div>
      {fallback ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
          Amazon에서 실가격을 못 가져와 $29.99 임시값으로 계산된 카드입니다.
          원본 가격을 확인한 뒤 URL을 다시 넣어 주세요.
        </p>
      ) : null}

      <div className="grid gap-3 rounded-xl border-2 border-sky-200 bg-sky-50/70 p-4 sm:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-sky-900/70">
            추천 판매가
          </p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-sky-950">
            {sellKrw != null
              ? `${sellKrw.toLocaleString("ko-KR")}원`
              : "—"}
          </p>
          {minViableKrw != null ? (
            <p className="mt-1 text-sm text-sky-900/80">
              최소 판매가{" "}
              <span className="font-semibold">
                {minViableKrw.toLocaleString("ko-KR")}원
              </span>
            </p>
          ) : null}
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <div>
            <dt className="text-xs text-zinc-500">
              {costCny != null
                ? "원가(CNY)"
                : costUsd != null
                  ? "원가(USD)"
                  : "원가"}
            </dt>
            <dd className="font-semibold text-zinc-900">
              {costCny != null
                ? `¥${costCny}`
                : costUsd != null
                  ? `$${costUsd.toLocaleString("en-US", {
                      maximumFractionDigits: 2,
                    })}`
                  : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">원가(KRW)</dt>
            <dd className="font-semibold text-zinc-900">
              {sourceCostKrw != null
                ? `${sourceCostKrw.toLocaleString("ko-KR")}원`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">국제배송</dt>
            <dd className="font-semibold text-zinc-900">
              {intlShippingKrw != null
                ? `${intlShippingKrw.toLocaleString("ko-KR")}원`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">경쟁 평균</dt>
            <dd className="font-semibold text-zinc-900">
              {competitorAvgKrw != null
                ? `${competitorAvgKrw.toLocaleString("ko-KR")}원`
                : "시세 없음"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">마진</dt>
            <dd className="font-semibold text-zinc-900">
              {marginRate != null
                ? `${(marginRate * 100).toFixed(1)}%`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">검색량</dt>
            <dd className="font-semibold text-zinc-900">
              {searchVolume != null
                ? searchVolume.toLocaleString("ko-KR")
                : "—"}
            </dd>
          </div>
        </dl>
      </div>

      <MarketVerdictBanner verdict={marketVerdict} />
    </div>
  );
}
