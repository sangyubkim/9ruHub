import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function DraftsPage() {
  const drafts = await prisma.productDraft.findMany({
    orderBy: { createdAt: "desc" },
    include: { sourceProduct: true, listings: true },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-3xl">초안 목록</h2>
          <p className="mt-1 text-sm text-zinc-600">최근 생성된 상품 초안을 관리합니다.</p>
        </div>
        <Link
          href="/drafts/new"
          className="rounded-full bg-sky-800 px-4 py-2 text-sm text-white hover:bg-sky-900"
        >
          새 초안
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white/90">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">제목</th>
              <th className="px-4 py-3 font-medium">ASIN</th>
              <th className="px-4 py-3 font-medium">판매가</th>
              <th className="px-4 py-3 font-medium">상태</th>
              <th className="px-4 py-3 font-medium">채널</th>
            </tr>
          </thead>
          <tbody>
            {drafts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-zinc-500">
                  아직 초안이 없습니다. URL 또는 엑셀로 생성하세요.
                </td>
              </tr>
            ) : (
              drafts.map((draft) => (
                <tr key={draft.id} className="border-t border-zinc-100 hover:bg-sky-50/40">
                  <td className="px-4 py-3">
                    <Link href={`/drafts/${draft.id}`} className="font-medium hover:text-sky-800">
                      {draft.titleKo}
                    </Link>
                    {draft.isFallbackData ? (
                      <p className="text-xs text-amber-700">폴백 데이터(수동 검수 권장)</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {draft.sourceProduct.externalId}
                  </td>
                  <td className="px-4 py-3">
                    {draft.salePriceKrw.toLocaleString("ko-KR")}원
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={draft.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {draft.listings.map((listing) => (
                        <StatusBadge
                          key={listing.id}
                          status={`${listing.channel}:${listing.status}`}
                        />
                      ))}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
