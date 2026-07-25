import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [total, draft, approved, published] = await Promise.all([
    prisma.productDraft.count(),
    prisma.productDraft.count({ where: { status: "DRAFT" } }),
    prisma.productDraft.count({ where: { status: "APPROVED" } }),
    prisma.productDraft.count({ where: { status: "PUBLISHED" } }),
  ]);

  const cards = [
    { label: "전체 초안", value: total },
    { label: "작성 중", value: draft },
    { label: "승인 완료", value: approved },
    { label: "등록 완료", value: published },
  ];

  return (
    <div className="space-y-8">
      <section className="max-w-2xl">
        <h2 className="font-[family-name:var(--font-display)] text-4xl leading-tight tracking-tight">
          Amazon US 소싱을
          <br />
          스마트스토어·쿠팡 초안으로
        </h2>
        <p className="mt-3 text-zinc-600">
          1차: URL/엑셀 → 초안 생성 → 승인 → 채널 스텁 등록 → 가격·품절 동기화까지
          한 파이프라인으로 연결합니다.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/drafts/new"
            className="rounded-full bg-sky-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-sky-900"
          >
            URL로 초안 만들기
          </Link>
          <Link
            href="/drafts/import"
            className="rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm hover:border-sky-500"
          >
            엑셀 대량 등록
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-zinc-200 bg-white/80 p-5 shadow-sm"
          >
            <p className="text-sm text-zinc-500">{card.label}</p>
            <p className="mt-2 text-3xl font-semibold">{card.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white/80 p-6">
        <h3 className="text-lg font-semibold">개발 스텝</h3>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-zinc-700">
          <li>초안 생성 (URL / 엑셀 / Amazon US) — 완료</li>
          <li>승인 후 스마트스토어·쿠팡 자동등록 (스텁 → API 키 연동)</li>
          <li>가격·품절 동기화 잡 실행</li>
        </ol>
      </section>
    </div>
  );
}
