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

export type ShippingQuoteView = {
  feeKrw: number;
  weightGrams: number;
  billableLbs: number | null;
  totalUsd: number | null;
  provider: string;
  tier: string;
  note: string | null;
  weightSource: "amazon_parse" | "default" | string;
};

export type CompetitorSampleView = {
  title: string;
  link: string;
  priceKrw: number;
  mallName: string;
  matchKind?: "same_likely" | "similar";
  matchLabel?: string;
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
  competitorSamples,
  naverKeyword,
  sourceCostKrw,
  intlShippingKrw,
  marginRate,
  targetMarginRate,
  searchVolume,
  shipping,
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
  competitorSamples?: CompetitorSampleView[] | null;
  naverKeyword?: string | null;
  sourceCostKrw?: number | null;
  intlShippingKrw?: number | null;
  /** 실마진 (판매가−원가)/판매가 */
  marginRate?: number | null;
  /** 가격 규칙 목표 마진 (MARGIN_RATE) */
  targetMarginRate?: number | null;
  searchVolume?: number | null;
  shipping?: ShippingQuoteView | null;
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
            <dt className="text-xs text-zinc-500">실마진</dt>
            <dd className="font-semibold text-zinc-900">
              {marginRate != null
                ? `${(marginRate * 100).toFixed(1)}%`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">목표 마진</dt>
            <dd className="font-semibold text-zinc-900">
              {targetMarginRate != null
                ? `${(targetMarginRate * 100).toFixed(0)}%`
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

      {shipping ? (
        <div className="rounded-xl border border-zinc-200 bg-white/80 px-3 py-2.5 text-xs text-zinc-600">
          <p className="font-semibold text-zinc-800">국제배송 근거</p>
          <p className="mt-1">
            무게{" "}
            <span className="font-medium text-zinc-900">
              {shipping.weightGrams.toLocaleString("ko-KR")}g
            </span>
            {shipping.billableLbs != null
              ? ` · 청구 ${shipping.billableLbs} LBS`
              : null}
            {shipping.weightSource === "default"
              ? " (기본값, 상품 무게 미파싱)"
              : " (Amazon 페이지 파싱)"}
          </p>
          <p className="mt-0.5">
            요금표{" "}
            <span className="font-medium text-zinc-900">
              {shipping.provider}
              {shipping.tier !== "n/a" ? ` · ${shipping.tier}` : ""}
            </span>
            {shipping.totalUsd != null
              ? ` · $${shipping.totalUsd.toFixed(2)}`
              : null}
            {intlShippingKrw != null
              ? ` → ${intlShippingKrw.toLocaleString("ko-KR")}원`
              : null}
          </p>
          {shipping.note ? (
            <p className="mt-0.5 text-zinc-500">{shipping.note}</p>
          ) : null}
        </div>
      ) : null}

      {competitorSamples && competitorSamples.length > 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white/80 px-3 py-2.5 text-xs text-zinc-600">
          <p className="font-semibold text-zinc-800">경쟁 샘플</p>
          <p className="mt-0.5 text-zinc-500">
            네이버 쇼핑 검색 결과 ·{" "}
            <span className="text-emerald-700">동일 추정</span>=모델·브랜드
            토큰 일치 · <span className="text-amber-700">유사</span>=같은
            키워드대 대체재
            {naverKeyword ? <> · 검색어 «{naverKeyword}»</> : null}
          </p>
          <ul className="mt-2 space-y-1.5">
            {competitorSamples.map((c) => {
              const same = c.matchKind === "same_likely";
              const label = c.matchLabel ?? (same ? "동일 추정" : "유사");
              return (
                <li
                  key={c.link}
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
                >
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      same
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-900"
                    }`}
                  >
                    {label}
                  </span>
                  <a
                    href={c.link}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-sky-800 underline underline-offset-2"
                  >
                    {c.title.length > 48 ? `${c.title.slice(0, 48)}…` : c.title}
                  </a>
                  <span className="text-zinc-800">
                    {c.priceKrw.toLocaleString("ko-KR")}원
                  </span>
                  <span className="text-zinc-400">{c.mallName}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <MarketVerdictBanner verdict={marketVerdict} />
    </div>
  );
}
