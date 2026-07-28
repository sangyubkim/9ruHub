import { MarketVerdictBanner } from "@/app/pricing/MarketVerdictBanner";
import type { DecisionGuide } from "@/lib/recommend/decision-guide";
import type { ProductViability } from "@/lib/recommend/product-viability";
import type { SourcingFit } from "@/lib/recommend/sourcing-fit";
import type { AmazonShipEligibility } from "@/lib/amazon/ship-eligibility";

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
  DEMAND_WATCH: "bg-amber-600 text-white",
};

const GRADE_PILL: Record<string, string> = {
  A: "bg-emerald-700 text-white",
  B: "bg-sky-700 text-white",
  C: "bg-zinc-600 text-white",
  D: "bg-red-700 text-white",
};

const RISK_PILL: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-900",
  medium: "bg-amber-100 text-amber-900",
  high: "bg-red-100 text-red-900",
};

const MARKET_TYPE_PILL: Record<string, string> = {
  PRICE_WAR: "bg-red-700 text-white",
  SCARCE: "bg-emerald-700 text-white",
  UNCLEAR: "bg-zinc-600 text-white",
};

const LETTER_PILL: Record<string, string> = {
  A: "bg-emerald-700 text-white",
  B: "bg-sky-700 text-white",
  C: "bg-zinc-600 text-white",
  D: "bg-amber-700 text-white",
  E: "bg-red-700 text-white",
};

const SOURCING_FIT_PILL: Record<string, string> = {
  PROXY_BUY_STRONG: "bg-emerald-700 text-white",
  PROXY_BUY: "bg-sky-700 text-white",
  DIRECT_SHIP_RISK: "bg-amber-600 text-white",
  US_FAIL: "bg-red-700 text-white",
  UNCLEAR: "bg-zinc-500 text-white",
};

function shipStatusKo(status: string | undefined): string {
  if (status === "ok") return "가능";
  if (status === "fail") return "불가";
  return "미확인";
}

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

export type ScorePartView = {
  label: string;
  value: number;
};

export type ScoreDetailView = {
  kind: "discover" | "amazon" | "other";
  parts: ScorePartView[];
  reasons: string[];
};

function formatRange(low: number, high: number): string {
  if (low === high) return `${low.toLocaleString("ko-KR")}원`;
  return `${low.toLocaleString("ko-KR")}~${high.toLocaleString("ko-KR")}원`;
}

function Stars({ n, label = "별점" }: { n: number; label?: string }) {
  return (
    <span className="tracking-tight text-amber-500" aria-label={`${label} ${n}점`}>
      {"★".repeat(n)}
      <span className="text-zinc-300">{"★".repeat(Math.max(0, 5 - n))}</span>
    </span>
  );
}

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
  scoreDetail,
  decisionGuide,
  productViability,
  sourcingFit,
  shipEligibility,
}: {
  score: number;
  reasonCode?: string | null;
  isStub?: boolean;
  isFallback?: boolean;
  costCny?: number | null;
  costUsd?: number | null;
  sellKrw?: number | null;
  minViableKrw?: number | null;
  competitorAvgKrw?: number | null;
  competitorSamples?: CompetitorSampleView[] | null;
  naverKeyword?: string | null;
  sourceCostKrw?: number | null;
  intlShippingKrw?: number | null;
  marginRate?: number | null;
  targetMarginRate?: number | null;
  searchVolume?: number | null;
  shipping?: ShippingQuoteView | null;
  marketVerdict?: Verdict | null;
  scoreDetail?: ScoreDetailView | null;
  decisionGuide?: DecisionGuide | null;
  productViability?: ProductViability | null;
  sourcingFit?: SourcingFit | null;
  shipEligibility?: AmazonShipEligibility | null;
}) {
  const verdictCode = marketVerdict?.code;
  const label = reasonCode ?? "—";
  const fallback = Boolean(isFallback || reasonCode === "FALLBACK");
  const kindLabel =
    scoreDetail?.kind === "discover"
      ? "수요(네이버) 규칙 점수"
      : scoreDetail?.kind === "amazon"
        ? "Amazon 규칙 점수"
        : "규칙 점수";
  const guide = decisionGuide;
  const viability = productViability;
  const fit = sourcingFit ?? viability?.sourcingFit ?? null;
  const ship = shipEligibility ?? viability?.shipEligibility ?? null;
  const recommendKrw =
    viability?.recommendedSaleKrw ?? guide?.recommendedSaleKrw ?? sellKrw ?? null;

  return (
    <div className="mt-4 space-y-3">
      {viability ? (
        <div className="space-y-3 rounded-xl border-2 border-zinc-800 bg-zinc-50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
                상품성 평가
              </p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-zinc-950">
                {viability.recommendLabel}{" "}
                <Stars n={viability.recommendStars} label="판매 추천도" />
              </p>
              <p className="mt-2 text-base leading-relaxed text-zinc-700">
                {viability.strategy}
              </p>
            </div>
            <span
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${MARKET_TYPE_PILL[viability.marketType] ?? MARKET_TYPE_PILL.UNCLEAR}`}
            >
              {viability.marketTypeLabel}
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-zinc-200">
              <dt className="text-xs text-zinc-500">가격 경쟁력</dt>
              <dd className="mt-1 flex items-center gap-2">
                <span
                  className={`rounded px-2 py-0.5 text-sm font-bold ${LETTER_PILL[viability.priceCompetitiveness] ?? LETTER_PILL.C}`}
                >
                  {viability.priceCompetitiveness}
                </span>
                <span className="text-sm text-zinc-600">
                  {viability.priceCompetitivenessLabel}
                </span>
              </dd>
            </div>
            <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-zinc-200">
              <dt className="text-xs text-zinc-500">희소성</dt>
              <dd className="mt-1 flex items-center gap-2">
                <span
                  className={`rounded px-2 py-0.5 text-sm font-bold ${LETTER_PILL[viability.scarcity] ?? LETTER_PILL.C}`}
                >
                  {viability.scarcity}
                </span>
                <span className="text-sm tabular-nums text-zinc-600">
                  {viability.scarcityScore}점
                </span>
              </dd>
            </div>
            <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-zinc-200">
              <dt className="text-xs text-zinc-500">예상 CS 위험</dt>
              <dd className="mt-1">
                <span
                  className={`rounded px-2 py-0.5 text-sm font-semibold ${RISK_PILL[viability.csRisk] ?? RISK_PILL.medium}`}
                >
                  {viability.csRiskLabel}
                </span>
              </dd>
            </div>
            <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-zinc-200">
              <dt className="text-xs text-zinc-500">예상 마진·판매가</dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums text-zinc-900">
                {viability.expectedProfitKrw != null
                  ? `${viability.expectedProfitKrw.toLocaleString("ko-KR")}원`
                  : "원가 대기"}
                {viability.saleLowKrw != null && viability.saleHighKrw != null ? (
                  <span className="mt-0.5 block text-xs font-normal text-zinc-500">
                    {formatRange(viability.saleLowKrw, viability.saleHighKrw)}
                  </span>
                ) : null}
              </dd>
            </div>
          </dl>
          {fit || ship ? (
            <div className="rounded-lg bg-white px-3 py-2.5 ring-1 ring-zinc-200">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-zinc-500">
                  구매대행 배송 시그널
                </span>
                {fit ? (
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${SOURCING_FIT_PILL[fit.code] ?? SOURCING_FIT_PILL.UNCLEAR}`}
                  >
                    {fit.label}
                  </span>
                ) : null}
                {ship ? (
                  <span className="text-xs tabular-nums text-zinc-600">
                    US {shipStatusKo(ship.us?.status)} · KR{" "}
                    {shipStatusKo(ship.kr?.status)}
                    {ship.krDirectShip === false
                      ? " · 직배송 불가(대행 유리)"
                      : ship.krDirectShip === true
                        ? " · 직배송 가능"
                        : ""}
                    {ship.confidence ? ` · 신뢰 ${ship.confidence}` : ""}
                  </span>
                ) : null}
              </div>
              {fit?.summary ? (
                <p className="mt-1 text-sm leading-relaxed text-zinc-600">
                  {fit.summary}
                </p>
              ) : ship?.note ? (
                <p className="mt-1 text-sm leading-relaxed text-zinc-600">
                  {ship.note}
                </p>
              ) : null}
            </div>
          ) : null}

          {viability.marketTypeReason ? (
            <p className="text-sm leading-relaxed text-zinc-600">
              <span className="font-medium text-zinc-800">시장 유형 근거: </span>
              {viability.marketTypeReason}
            </p>
          ) : null}

          {viability.csRiskReasons?.length ? (
            <p className="text-sm leading-relaxed text-zinc-600">
              <span className="font-medium text-zinc-800">CS 기준: </span>
              {viability.csRiskReasons.join(" · ")}
            </p>
          ) : null}

          {viability.referenceLinks && viability.referenceLinks.length > 0 ? (
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="font-medium text-zinc-800">참조 링크</span>
              {viability.referenceLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  title={link.description}
                  className="rounded-md bg-white px-2.5 py-1 font-medium text-sky-800 underline underline-offset-2 ring-1 ring-zinc-200"
                >
                  {link.label}
                </a>
              ))}
            </div>
          ) : null}

          {viability.scarcityBreakdown.length > 0 ? (
            <details className="rounded-lg bg-white/80 px-3 py-2 text-sm text-zinc-600">
              <summary className="cursor-pointer font-medium text-zinc-800">
                희소성 가산 내역 · 신뢰도 {viability.confidence}
              </summary>
              <ul className="mt-3 space-y-3">
                {viability.scarcityBreakdown.map((b) => (
                  <li key={b.key} className="border-b border-zinc-100 pb-2 last:border-0">
                    <div className="flex justify-between gap-3 tabular-nums">
                      <span className="font-medium text-zinc-800">{b.label}</span>
                      <span
                        className={
                          b.points < 0 ? "text-red-600" : "text-zinc-900"
                        }
                      >
                        {b.points > 0 ? `+${b.points}` : b.points}
                      </span>
                    </div>
                    {b.criteria ? (
                      <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                        기준: {b.criteria}
                      </p>
                    ) : null}
                    {b.note ? (
                      <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                        {b.note}
                      </p>
                    ) : null}
                    {b.refs && b.refs.length > 0 ? (
                      <p className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
                        {b.refs.map((r) => (
                          <a
                            key={`${b.key}-${r.href}`}
                            href={r.href}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sky-700 underline underline-offset-2"
                          >
                            {r.label}
                          </a>
                        ))}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
              {viability.methodology && viability.methodology.length > 0 ? (
                <div className="mt-3 border-t border-zinc-200 pt-2">
                  <p className="font-medium text-zinc-800">평가 방법</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-xs leading-relaxed text-zinc-500">
                    {viability.methodology.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </details>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <span className="group relative inline-flex">
          <span
            className={`cursor-help rounded-md px-3 py-1.5 text-sm font-semibold ${LABEL_PILL[label] ?? "bg-zinc-200 text-zinc-800"}`}
            tabIndex={0}
          >
            {label} · {score.toFixed(1)}점
          </span>
          {scoreDetail &&
          (scoreDetail.parts.length > 0 || scoreDetail.reasons.length > 0) ? (
            <span
              role="tooltip"
              className="pointer-events-none absolute left-0 top-full z-30 mt-2 w-80 max-w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-zinc-700 bg-zinc-900 p-3.5 text-left text-xs leading-relaxed text-zinc-100 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
            >
              <span className="mb-1.5 block font-semibold text-white">
                {kindLabel} · 합계 {score.toFixed(1)}
              </span>
              {scoreDetail.parts.length > 0 ? (
                <ul className="mb-2 space-y-0.5 border-b border-zinc-700 pb-2">
                  {scoreDetail.parts.map((part) => (
                    <li
                      key={part.label}
                      className="flex justify-between gap-3 tabular-nums"
                    >
                      <span className="text-zinc-300">{part.label}</span>
                      <span
                        className={
                          part.value < 0 ? "text-red-300" : "text-zinc-50"
                        }
                      >
                        {part.value > 0 ? `+${part.value}` : part.value}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {scoreDetail.reasons.length > 0 ? (
                <ul className="list-disc space-y-0.5 pl-3.5 text-zinc-300">
                  {scoreDetail.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-zinc-400">상세 사유 없음</span>
              )}
            </span>
          ) : null}
        </span>
        {guide ? (
          <>
            <span
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${GRADE_PILL[guide.grade] ?? GRADE_PILL.C}`}
            >
              추천도 {guide.grade} · {guide.gradeLabel}
            </span>
            <span
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${RISK_PILL[guide.risk] ?? RISK_PILL.medium}`}
            >
              위험도 {guide.riskLabel}
            </span>
            <span className="rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-zinc-800 ring-1 ring-zinc-200">
              가격경쟁력(시세) <Stars n={guide.competitionStars} label="시세 대비" />
            </span>
          </>
        ) : null}
        {verdictCode ? (
          <span
            className={`rounded-md px-3 py-1.5 text-sm font-semibold ${VERDICT_PILL[verdictCode] ?? VERDICT_PILL.NO_MARKET_DATA}`}
          >
            시장성 {marketVerdict?.label ?? verdictCode}
          </span>
        ) : null}
        {fallback ? (
          <span className="rounded-md bg-red-100 px-3 py-1.5 text-sm font-semibold text-red-900">
            가격 미확인(폴백)
          </span>
        ) : null}
        {isStub ? (
          <span className="rounded-md bg-orange-100 px-3 py-1.5 text-sm font-semibold text-orange-900">
            STUB
          </span>
        ) : null}
      </div>

      {fallback ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-900">
          Amazon이 앱 서버 요청을 차단하거나 가격 HTML을 못 읽어 $29.99
          임시값입니다. 브라우저에 보이는 실가(예: $41.98)를 기준으로
          아래 수동 입력으로 원가·무게를 수정하세요.
        </p>
      ) : null}

      {guide ? (
        <div className="space-y-4 rounded-xl border-2 border-sky-200 bg-sky-50/70 p-5">
          <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-sky-900/70">
                추천 판매가
              </p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight text-sky-950">
                {recommendKrw != null
                  ? `${recommendKrw.toLocaleString("ko-KR")}원`
                  : "—"}
              </p>
              <p className="mt-2 text-base text-sky-900/80">
                예상 판매가{" "}
                <span className="font-semibold">
                  {formatRange(guide.saleLowKrw, guide.saleHighKrw)}
                </span>
              </p>
              <p className="mt-1 text-base font-medium text-emerald-900">
                예상 순이익{" "}
                {guide.expectedProfitKrw.toLocaleString("ko-KR")}원
                <span className="ml-1 text-sm font-normal text-emerald-800/80">
                  (범위 {formatRange(guide.profitLowKrw, guide.profitHighKrw)})
                </span>
              </p>
              <p className="mt-2 text-sm leading-relaxed text-sky-950/80">
                {guide.summary}
              </p>
            </div>

            <ol className="space-y-2 text-base">
              <li className="flex justify-between gap-3 border-b border-sky-100 pb-2">
                <span className="text-zinc-500">상품 원가</span>
                <span className="font-semibold tabular-nums text-zinc-900">
                  {guide.productCostKrw.toLocaleString("ko-KR")}원
                  {costUsd != null
                    ? ` · $${costUsd.toLocaleString("en-US", {
                        maximumFractionDigits: 2,
                      })}`
                    : costCny != null
                      ? ` · ¥${costCny}`
                      : ""}
                </span>
              </li>
              <li className="flex justify-between gap-3 border-b border-sky-100 pb-2">
                <span className="text-zinc-500">예상 배송</span>
                <span className="font-semibold tabular-nums text-zinc-900">
                  {formatRange(guide.shippingLowKrw, guide.shippingHighKrw)}
                </span>
              </li>
              <li className="flex justify-between gap-3 border-b border-sky-100 pb-2">
                <span className="text-zinc-500">예상 판매가</span>
                <span className="font-semibold tabular-nums text-zinc-900">
                  {formatRange(guide.saleLowKrw, guide.saleHighKrw)}
                </span>
              </li>
              <li className="flex justify-between gap-3 border-b border-sky-100 pb-2">
                <span className="text-zinc-500">경쟁 시세</span>
                <span className="font-semibold tabular-nums text-zinc-900">
                  {guide.competitorAvgKrw != null
                    ? `${guide.competitorAvgKrw.toLocaleString("ko-KR")}원`
                    : "시세 없음"}
                </span>
              </li>
              <li className="flex justify-between gap-3 border-b border-sky-100 pb-2">
                <span className="text-zinc-500">추천</span>
                <span className="font-semibold tabular-nums text-sky-900">
                  {guide.recommendedSaleKrw.toLocaleString("ko-KR")}원
                </span>
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-zinc-500">예상 순이익</span>
                <span className="font-semibold tabular-nums text-emerald-800">
                  {guide.expectedProfitKrw.toLocaleString("ko-KR")}원
                </span>
              </li>
            </ol>
          </div>

          <details className="rounded-lg bg-white/70 px-3 py-2 text-sm text-zinc-600">
            <summary className="cursor-pointer font-medium text-zinc-800">
              계산 가정 · 손익분기{" "}
              {guide.minViableSaleKrw.toLocaleString("ko-KR")}원
              {searchVolume != null
                ? ` · 검색량 ${searchVolume.toLocaleString("ko-KR")}`
                : ""}
            </summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {guide.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
              {targetMarginRate != null ? (
                <li>목표 마진 {(targetMarginRate * 100).toFixed(0)}%</li>
              ) : null}
              {marginRate != null ? (
                <li>
                  참고 실마진(원가 대비 판매가 여유){" "}
                  {(marginRate * 100).toFixed(1)}%
                </li>
              ) : null}
            </ul>
          </details>
        </div>
      ) : (
        <div className="grid gap-4 rounded-xl border-2 border-sky-200 bg-sky-50/70 p-5 sm:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-sky-900/70">
              추천 판매가
            </p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight text-sky-950">
              {sellKrw != null
                ? `${sellKrw.toLocaleString("ko-KR")}원`
                : "—"}
            </p>
            {minViableKrw != null ? (
              <p className="mt-1 text-base text-sky-900/80">
                최소 판매가{" "}
                <span className="font-semibold">
                  {minViableKrw.toLocaleString("ko-KR")}원
                </span>
              </p>
            ) : null}
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-base">
            <div>
              <dt className="text-sm text-zinc-500">원가</dt>
              <dd className="text-lg font-semibold text-zinc-900">
                {sourceCostKrw != null
                  ? `${sourceCostKrw.toLocaleString("ko-KR")}원`
                  : costUsd != null
                    ? `$${costUsd}`
                    : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-zinc-500">국제배송</dt>
              <dd className="text-lg font-semibold text-zinc-900">
                {intlShippingKrw != null
                  ? `${intlShippingKrw.toLocaleString("ko-KR")}원`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-zinc-500">경쟁 시세</dt>
              <dd className="text-lg font-semibold text-zinc-900">
                {competitorAvgKrw != null
                  ? `${competitorAvgKrw.toLocaleString("ko-KR")}원`
                  : "시세 없음"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-zinc-500">검색량</dt>
              <dd className="text-lg font-semibold text-zinc-900">
                {searchVolume != null
                  ? searchVolume.toLocaleString("ko-KR")
                  : "—"}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {shipping ? (
        <div className="rounded-xl border border-zinc-200 bg-white/80 px-4 py-3 text-sm text-zinc-600">
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
        <div className="rounded-xl border border-zinc-200 bg-white/80 px-4 py-3 text-sm text-zinc-600">
          <p className="font-semibold text-zinc-800">경쟁 샘플</p>
          <p className="mt-0.5 text-zinc-500">
            네이버 쇼핑 ·{" "}
            <span className="text-emerald-700">동일 추정</span> /{" "}
            <span className="text-amber-700">유사</span>
            {naverKeyword ? <> · 검색어 «{naverKeyword}»</> : null}
          </p>
          <ul className="mt-2 space-y-1.5">
            {competitorSamples.map((c) => {
              const same = c.matchKind === "same_likely";
              const sampleLabel =
                c.matchLabel ?? (same ? "동일 추정" : "유사");
              return (
                <li
                  key={c.link}
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
                >
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                      same
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-900"
                    }`}
                  >
                    {sampleLabel}
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
