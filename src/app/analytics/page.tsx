import { MorningReportPanel } from "@/app/analytics/MorningReportPanel";
import { OpsAssistantForm } from "@/app/analytics/OpsAssistantForm";
import { PeriodToggle } from "@/app/analytics/PeriodToggle";
import { listConversations } from "@/lib/analytics/assistant";
import {
  buildAnalyticsSnapshot,
  parseAnalyticsPeriod,
} from "@/lib/analytics/metrics";
import { getLatestMorningReport } from "@/lib/analytics/morning-report";

export const dynamic = "force-dynamic";

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

const PERIOD_LABEL: Record<string, string> = {
  today: "오늘",
  "7d": "최근 7일",
  "30d": "최근 30일",
  all: "전체 기간",
};

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const params = await searchParams;
  const period = parseAnalyticsPeriod(params.period);
  const [snapshot, conversations, morningReport] = await Promise.all([
    buildAnalyticsSnapshot(undefined, period),
    listConversations(),
    getLatestMorningReport(),
  ]);
  const r = snapshot.revenue;
  const rec = snapshot.recommendations;
  const periodLabel = PERIOD_LABEL[period] ?? "오늘";

  const cards = [
    {
      label: `${periodLabel} 판매 건수`,
      value: r.orderCount.toLocaleString("ko-KR"),
    },
    {
      label: "매출",
      value: `${r.subtotalKrw.toLocaleString("ko-KR")}원`,
    },
    {
      label: "순이익",
      value: `${r.profitKrw.toLocaleString("ko-KR")}원`,
    },
    {
      label: "광고비",
      value: `${r.adSpendKrw.toLocaleString("ko-KR")}원`,
    },
    {
      label: "ROI",
      value: pct(r.roi),
      hint: "순이익 ÷ 광고비",
    },
    {
      label: "환불률",
      value: pct(r.refundRate),
      hint: `환불 ${r.refundedOrderCount}건 / ${r.orderCount}건`,
    },
  ];

  return (
    <div className="space-y-8">
      <section className="max-w-2xl">
        <h2 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
          AI 수익 분석
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          주문·원가·광고비·환불을 DB에서 집계합니다. 운영 비서는 이 스냅샷만
          설명하며 숫자를 새로 만들지 않습니다.
        </p>
        <PeriodToggle period={period} />
        <p className="mt-2 text-xs text-zinc-500">
          스냅샷: {new Date(snapshot.generatedAt).toLocaleString("ko-KR")} ·{" "}
          {periodLabel}
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-zinc-200 bg-white/80 p-5"
          >
            <p className="text-sm text-zinc-500">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold">{card.value}</p>
            {"hint" in card && card.hint ? (
              <p className="mt-1 text-xs text-zinc-400">{card.hint}</p>
            ) : null}
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white/80 p-5">
          <h3 className="font-semibold">Top 상품</h3>
          {snapshot.topProducts.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">판매 데이터 없음</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {snapshot.topProducts.map((p, idx) => (
                <li
                  key={`${p.productId ?? p.title}-${idx}`}
                  className="flex justify-between gap-3 border-t border-zinc-100 pt-2"
                >
                  <span>
                    {idx + 1}. {p.title}{" "}
                    <span className="text-zinc-500">×{p.quantity}</span>
                  </span>
                  <span className="shrink-0 text-zinc-700">
                    {p.revenueKrw.toLocaleString("ko-KR")}원
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white/80 p-5">
          <h3 className="font-semibold">상세 / 추천 성과</h3>
          <ul className="mt-3 space-y-1 text-sm text-zinc-700">
            <li>마진율 {pct(r.marginRate)}</li>
            <li>
              원가 {r.costKrw.toLocaleString("ko-KR")}원 · 수수료{" "}
              {r.platformFeeKrw.toLocaleString("ko-KR")}원 · 배송비{" "}
              {r.shippingFeeKrw.toLocaleString("ko-KR")}원
            </li>
            <li>환불액 {r.refundedKrw.toLocaleString("ko-KR")}원</li>
            <li>
              추천 전체 {rec.total}건 · 대기 {rec.pending} · 수락·초안{" "}
              {rec.acceptedOrDrafted} · 무시 {rec.ignored}
            </li>
            <li>
              평균 점수 {rec.avgScore.toFixed(1)} · 전환율{" "}
              {pct(rec.conversionRate)}
            </li>
            <li>
              물류 미완료 {snapshot.logistics.openShipments} / 배송완료{" "}
              {snapshot.logistics.deliveredShipments}
            </li>
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white/80 p-5">
        <h3 className="font-semibold">아침 브리핑</h3>
        <p className="mt-1 text-sm text-zinc-600">
          전일 대비 매출·경쟁가·재고·광고 중지 후보를 DB에서 계산합니다.
        </p>
        <div className="mt-4">
          <MorningReportPanel
            initialReport={
              morningReport
                ? {
                    id: morningReport.id,
                    reportDate: morningReport.reportDate.toISOString(),
                    narrative: morningReport.narrative,
                    usedGpt: morningReport.usedGpt,
                    insights: morningReport.insights,
                  }
                : null
            }
          />
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white/80 p-5">
        <h3 className="font-semibold">운영 비서</h3>
        <p className="mt-1 text-sm text-zinc-600">
          DB 집계 컨텍스트 기반 설명 (OPENAI_API_KEY 없으면 템플릿 요약)
        </p>
        <OpsAssistantForm period={period} />
        {conversations[0] ? (
          <div className="mt-6 space-y-3 border-t border-zinc-100 pt-4">
            <p className="text-xs text-zinc-500">
              최근 대화: {conversations[0].title ?? conversations[0].id}
            </p>
            {conversations[0].messages.map((m) => (
              <div key={m.id} className="text-sm">
                <p className="font-medium text-zinc-500">{m.role}</p>
                <p className="whitespace-pre-wrap text-zinc-800">{m.content}</p>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
