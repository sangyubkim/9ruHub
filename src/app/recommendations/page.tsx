import Link from "next/link";
import { prisma } from "@/lib/db";
import { getDefaultTenantId } from "@/lib/tenant";
import { RecommendActions } from "@/app/recommendations/RecommendActions";
import { RecommendGenerateForm } from "@/app/recommendations/RecommendGenerateForm";

export const dynamic = "force-dynamic";

export default async function RecommendationsPage() {
  const tenantId = await getDefaultTenantId();
  const items = await prisma.aiRecommendation.findMany({
    where: { tenantId },
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
    include: {
      draft: { select: { id: true, status: true } },
      product: { select: { id: true, salePriceKrw: true, sourcePrice: true } },
    },
    take: 100,
  });

  return (
    <div className="space-y-8">
      <section className="max-w-2xl">
        <h2 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
          AI 추천 (규칙 점수)
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          점수는 코드 규칙으로 계산하고, GPT는 이유/상세 문구만 담당합니다(키 없으면
          템플릿). 원클릭으로 초안을 만든 뒤 승인·등록 흐름으로 이어집니다.
        </p>
      </section>

      <RecommendGenerateForm />

      <section className="space-y-3">
        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-300 bg-white/60 p-8 text-sm text-zinc-500">
            추천이 없습니다. 상품 초안을 만든 뒤 「기존 상품 스캔」하거나 URL로
            추천을 생성하세요.
          </p>
        ) : (
          items.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-zinc-200 bg-white/80 p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-sky-800">
                    {item.reasonCode ?? "—"} · {Number(item.score).toFixed(1)}점
                  </p>
                  <h3 className="mt-1 text-lg font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm text-zinc-600">{item.reasonText}</p>
                  {item.sourceUrl ? (
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs text-sky-800 underline"
                    >
                      원본 보기
                    </a>
                  ) : null}
                </div>
                <div className="text-right text-xs text-zinc-500">
                  <p>상태: {item.status}</p>
                  {item.draftId ? (
                    <Link
                      href={`/drafts/${item.draftId}`}
                      className="mt-1 inline-block text-sky-800 underline"
                    >
                      초안 열기
                    </Link>
                  ) : null}
                </div>
              </div>
              <RecommendActions
                id={item.id}
                status={item.status}
                draftId={item.draftId}
              />
            </article>
          ))
        )}
      </section>
    </div>
  );
}
