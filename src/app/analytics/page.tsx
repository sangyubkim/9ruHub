import { buildAnalyticsSnapshot } from "@/lib/analytics/metrics";
import { listConversations } from "@/lib/analytics/assistant";
import { OpsAssistantForm } from "@/app/analytics/OpsAssistantForm";

export const dynamic = "force-dynamic";

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export default async function AnalyticsPage() {
  const [snapshot, conversations] = await Promise.all([
    buildAnalyticsSnapshot(),
    listConversations(),
  ]);
  const r = snapshot.revenue;
  const rec = snapshot.recommendations;

  const cards = [
    { label: "주문 수", value: r.orderCount.toLocaleString("ko-KR") },
    { label: "매출", value: `${r.subtotalKrw.toLocaleString("ko-KR")}원` },
    { label: "이익", value: `${r.profitKrw.toLocaleString("ko-KR")}원` },
    { label: "마진율", value: pct(r.marginRate) },
  ];

  return (
    <div className="space-y-8">
      <section className="max-w-2xl">
        <h2 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
          AI 수익 분석
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          주문·원가·추천 피드백를 DB에서 집계합니다. 운영 비서는 이 스냅샷만
          설명하며 숫자를 새로 만들지 않습니다.
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          스냅샷: {new Date(snapshot.generatedAt).toLocaleString("ko-KR")}
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-zinc-200 bg-white/80 p-5"
          >
            <p className="text-sm text-zinc-500">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold">{card.value}</p>
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
          <h3 className="font-semibold">추천 성과</h3>
          <ul className="mt-3 space-y-1 text-sm text-zinc-700">
            <li>전체 {rec.total}건</li>
            <li>대기 {rec.pending} / 수락·초안 {rec.acceptedOrDrafted} / 무시 {rec.ignored}</li>
            <li>평균 점수 {rec.avgScore.toFixed(1)}</li>
            <li>전환율 {pct(rec.conversionRate)}</li>
          </ul>
          <div className="mt-4 text-sm text-zinc-600">
            <p>원가 {r.costKrw.toLocaleString("ko-KR")}원</p>
            <p>플랫폼 수수료 {r.platformFeeKrw.toLocaleString("ko-KR")}원</p>
            <p>배송비 {r.shippingFeeKrw.toLocaleString("ko-KR")}원</p>
            <p>환불 {r.refundedKrw.toLocaleString("ko-KR")}원</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white/80 p-5">
        <h3 className="font-semibold">운영 비서</h3>
        <p className="mt-1 text-sm text-zinc-600">
          DB 집계 컨텍스트 기반 설명 (OPENAI_API_KEY 없으면 템플릿 요약)
        </p>
        <OpsAssistantForm />
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
