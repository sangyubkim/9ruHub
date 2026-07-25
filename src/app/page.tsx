import Link from "next/link";
import { buildAnalyticsSnapshot } from "@/lib/analytics/metrics";
import { prisma } from "@/lib/db";
import { getDefaultTenantId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const tenantId = await getDefaultTenantId();
  // One groupBy + snapshot (snapshot itself is sequential) — avoids nested
  // Promise.all storms that close Prisma local postgres connections (P1017).
  const [statusCounts, snapshot] = await Promise.all([
    prisma.productDraft.groupBy({
      by: ["status"],
      where: { tenantId },
      _count: { _all: true },
    }),
    buildAnalyticsSnapshot(tenantId),
  ]);

  const countByStatus = Object.fromEntries(
    statusCounts.map((row) => [row.status, row._count._all]),
  ) as Partial<Record<string, number>>;
  const draft = countByStatus.DRAFT ?? 0;
  const approved = countByStatus.APPROVED ?? 0;
  const published = countByStatus.PUBLISHED ?? 0;
  const total = statusCounts.reduce((sum, row) => sum + row._count._all, 0);

  const r = snapshot.revenue;
  const draftCards = [
    { label: "전체 초안", value: total },
    { label: "작성 중", value: draft },
    { label: "승인 완료", value: approved },
    { label: "등록 완료", value: published },
  ];

  const profitCards = [
    {
      label: "매출",
      value: `${r.subtotalKrw.toLocaleString("ko-KR")}원`,
    },
    {
      label: "추정이익",
      value: `${r.profitKrw.toLocaleString("ko-KR")}원`,
    },
    {
      label: "마진율",
      value: `${(r.marginRate * 100).toFixed(1)}%`,
    },
    {
      label: "주문 / 미완료배송",
      value: `${r.orderCount} / ${snapshot.logistics.openShipments}`,
    },
  ];

  return (
    <div className="space-y-8">
      <section className="max-w-2xl">
        <h2 className="font-[family-name:var(--font-display)] text-4xl leading-tight tracking-tight">
          Sourcing Hub
          <br />
          AI 구매대행 OS
        </h2>
        <p className="mt-3 text-zinc-600">
          소싱 초안·채널 등록부터 추천·주문·물류·수익분석까지 SaaS 테넌트 기반
          파이프라인으로 연결합니다.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/analytics"
            className="rounded-full bg-sky-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-sky-900"
          >
            수익분석 / 운영 비서
          </Link>
          <Link
            href="/recommendations"
            className="rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm hover:border-sky-500"
          >
            AI 발굴
          </Link>
          <Link
            href="/ai-detail"
            className="rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm hover:border-sky-500"
          >
            AI 상세 제작
          </Link>
          <Link
            href="/drafts/new"
            className="rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm hover:border-sky-500"
          >
            URL 초안
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {draftCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-zinc-200 bg-white/80 p-5 shadow-sm"
          >
            <p className="text-sm text-zinc-500">{card.label}</p>
            <p className="mt-2 text-3xl font-semibold">{card.value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {profitCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-zinc-200 bg-white/80 p-5"
          >
            <p className="text-sm text-zinc-500">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold">{card.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white/80 p-6">
        <h3 className="text-lg font-semibold">Step 현황</h3>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-zinc-700">
          <li>SaaS DB/ERD — 완료</li>
          <li>규칙 추천 + GPT 상세/원클릭 — 완료</li>
          <li>주문 + 중국몰 스텁 — 완료</li>
          <li>배대지 + 송장 스텁 — 완료</li>
          <li>수익분석 + 운영 비서 — 완료</li>
          <li>SaaS 빌링/멀티유저 고도화 — 예정</li>
        </ol>
      </section>
    </div>
  );
}
