import Link from "next/link";
import { getProfitMetrics } from "@/lib/analytics/service";
import { prisma } from "@/lib/db";
import { getDefaultTenantId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const tenantId = await getDefaultTenantId();
  const [total, draft, approved, published, metrics] = await Promise.all([
    prisma.productDraft.count({ where: { tenantId } }),
    prisma.productDraft.count({ where: { tenantId, status: "DRAFT" } }),
    prisma.productDraft.count({ where: { tenantId, status: "APPROVED" } }),
    prisma.productDraft.count({ where: { tenantId, status: "PUBLISHED" } }),
    getProfitMetrics(tenantId),
  ]);

  const draftCards = [
    { label: "전체 초안", value: total },
    { label: "작성 중", value: draft },
    { label: "승인 완료", value: approved },
    { label: "등록 완료", value: published },
  ];

  const profitCards = [
    {
      label: "매출",
      value: `${metrics.revenueKrw.toLocaleString("ko-KR")}원`,
    },
    {
      label: "추정이익",
      value: `${metrics.profitKrw.toLocaleString("ko-KR")}원`,
    },
    {
      label: "마진율",
      value: `${(metrics.marginRate * 100).toFixed(1)}%`,
    },
    {
      label: "주문 / 미완료배송",
      value: `${metrics.orderCount} / ${metrics.openShipments}`,
    },
  ];

  return (
    <div className="space-y-8">
      <section className="max-w-2xl">
        <h2 className="font-[family-name:var(--font-display)] text-4xl leading-tight tracking-tight">
          AI 구매대행 OS
          <br />
          수익까지 한눈에
        </h2>
        <p className="mt-3 text-zinc-600">
          소싱·추천·주문·물류 파이프라인과 DB 기반 수익 분석, 운영 비서를
          연결합니다. 숫자는 코드가 집계하고 GPT는 설명만 담당합니다.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/assistant"
            className="rounded-full bg-sky-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-sky-900"
          >
            운영 비서 열기
          </Link>
          <Link
            href="/recommendations"
            className="rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm hover:border-sky-500"
          >
            AI 추천
          </Link>
          <Link
            href="/drafts/new"
            className="rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm hover:border-sky-500"
          >
            URL 초안
          </Link>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold tracking-wide text-zinc-500">
          수익 분석 (DB 집계)
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {profitCards.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-zinc-200 bg-white/80 p-5 shadow-sm"
            >
              <p className="text-sm text-zinc-500">{card.label}</p>
              <p className="mt-2 text-2xl font-semibold">{card.value}</p>
            </div>
          ))}
        </div>
        {metrics.topProducts.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-zinc-200 bg-white/80 p-5">
            <h4 className="text-sm font-semibold">상위 이익 상품</h4>
            <ul className="mt-2 space-y-1 text-sm text-zinc-700">
              {metrics.topProducts.map((p) => (
                <li key={p.productId}>
                  {p.title} · 이익 {p.profitKrw.toLocaleString("ko-KR")}원 · 판매{" "}
                  {p.soldQty}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold tracking-wide text-zinc-500">
          초안 파이프라인
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {draftCards.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-zinc-200 bg-white/80 p-5 shadow-sm"
            >
              <p className="text-sm text-zinc-500">{card.label}</p>
              <p className="mt-2 text-3xl font-semibold">{card.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white/80 p-6">
        <h3 className="text-lg font-semibold">제품 단계</h3>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-zinc-700">
          <li>SaaS DB/ERD + Amazon 초안→채널 등록 — 완료</li>
          <li>규칙 추천 + GPT 이유/상세 + 원클릭 초안 — 완료</li>
          <li>주문 관리 + 중국몰 스텁 — 완료</li>
          <li>배대지 + 송장 스텁 — 완료</li>
          <li>AI 수익분석 대시보드 + 운영 비서 — 완료</li>
          <li>SaaS 빌링 / 멀티유저 고도화 — 미착수</li>
        </ol>
      </section>
    </div>
  );
}
