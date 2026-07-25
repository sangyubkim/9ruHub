import Link from "next/link";
import { notFound } from "next/navigation";
import { DraftStatus } from "@/generated/prisma/client";
import { StatusBadge } from "@/components/StatusBadge";
import { prisma } from "@/lib/db";
import { getDefaultTenantId } from "@/lib/tenant";
import { AiDetailActions } from "./AiDetailActions";
import { DraftActions } from "./DraftActions";
import { DraftEditForm } from "./DraftEditForm";
import { DraftPricingPanel } from "./DraftPricingPanel";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function DraftDetailPage({ params }: Props) {
  const { id } = await params;
  const tenantId = await getDefaultTenantId();
  const draft = await prisma.productDraft.findFirst({
    where: {
      id,
      tenantId,
      status: { not: DraftStatus.ARCHIVED },
    },
    include: {
      sourceProduct: true,
      listings: true,
      publishLogs: { orderBy: { createdAt: "desc" }, take: 10 },
      syncJobs: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });

  if (!draft) notFound();

  const images = Array.isArray(draft.images) ? (draft.images as string[]) : [];
  const breakdown = draft.costBreakdown as Record<string, unknown>;
  const keywords = Array.isArray(draft.keywords)
    ? (draft.keywords as string[])
    : [];
  const aiMeta =
    draft.aiMeta && typeof draft.aiMeta === "object"
      ? (draft.aiMeta as Record<string, unknown>)
      : null;
  const sourcePriceKrw =
    typeof breakdown.sourcePriceKrw === "number"
      ? breakdown.sourcePriceKrw
      : typeof breakdown.sourceCostKrw === "number"
        ? breakdown.sourceCostKrw
        : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/drafts" className="text-sm text-sky-800">
            ← 목록
          </Link>
          <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl">
            {draft.titleKo}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={draft.status} />
            {draft.isFallbackData ? (
              <StatusBadge status="FALLBACK" />
            ) : null}
          </div>
        </div>
        <a
          href={draft.sourceProduct.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm"
        >
          원본 보기
        </a>
      </div>

      <DraftActions id={draft.id} status={draft.status} />
      <AiDetailActions id={draft.id} />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white/90 p-5">
          <h3 className="font-semibold">원본 / 가격</h3>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-zinc-500">ASIN</dt>
              <dd className="font-mono">{draft.sourceProduct.externalId}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">원가</dt>
              <dd>
                {draft.sourceProduct.currency === "USD" ? "$" : ""}
                {Number(draft.sourceProduct.sourcePrice)}
                {sourcePriceKrw != null
                  ? ` / ${sourcePriceKrw.toLocaleString("ko-KR")}원`
                  : ""}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">판매가</dt>
              <dd className="text-lg font-semibold">
                {draft.salePriceKrw.toLocaleString("ko-KR")}원
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">재고</dt>
              <dd>{draft.sourceProduct.inStock ? "있음" : "없음"}</dd>
            </div>
          </dl>
          <div className="grid grid-cols-3 gap-2">
            {images.slice(0, 6).map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src}
                src={src}
                alt=""
                className="aspect-square rounded-lg border border-zinc-200 object-cover"
              />
            ))}
          </div>
        </section>

        <DraftEditForm
          key={`${draft.id}-${draft.updatedAt.toISOString()}`}
          id={draft.id}
          titleKo={draft.titleKo}
          salePriceKrw={draft.salePriceKrw}
          detailHtml={draft.detailHtml}
          noticeText={draft.noticeText}
          reviewNote={draft.reviewNote}
          keywords={keywords}
        />
      </div>

      <DraftPricingPanel
        draftId={draft.id}
        salePriceKrw={draft.salePriceKrw}
        breakdown={breakdown}
        sourcePrice={Number(draft.sourceProduct.sourcePrice)}
        currency={draft.sourceProduct.currency}
      />

      {(keywords.length > 0 || aiMeta) && (
        <section className="rounded-2xl border border-zinc-200 bg-white/90 p-5">
          <h3 className="font-semibold">AI 메타 / 키워드</h3>
          {aiMeta ? (
            <p className="mt-2 text-sm text-zinc-600">
              {aiMeta.usedGpt ? "GPT" : "템플릿"} · 원문{" "}
              {String(aiMeta.sourceLang ?? "-")}
              {typeof aiMeta.translationNote === "string"
                ? ` — ${aiMeta.translationNote}`
                : ""}
            </p>
          ) : null}
          {keywords.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {keywords.map((kw) => (
                <span
                  key={kw}
                  className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs"
                >
                  {kw}
                </span>
              ))}
            </div>
          ) : null}
        </section>
      )}

      <section className="rounded-2xl border border-zinc-200 bg-white/90 p-5">
        <h3 className="font-semibold">채널 리스팅</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {draft.listings.map((listing) => (
            <li key={listing.id} className="flex flex-wrap items-center gap-2">
              <StatusBadge status={listing.channel} />
              <StatusBadge status={listing.status} />
              <span className="text-zinc-500">
                {listing.externalProductId ?? "미발급"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white/90 p-5">
          <h3 className="font-semibold">등록 로그</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {draft.publishLogs.length === 0 ? (
              <li className="text-zinc-500">아직 없음</li>
            ) : (
              draft.publishLogs.map((log) => (
                <li key={log.id}>
                  [{log.channel}] {log.success ? "OK" : "FAIL"} — {log.message}
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white/90 p-5">
          <h3 className="font-semibold">동기화 잡</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {draft.syncJobs.length === 0 ? (
              <li className="text-zinc-500">아직 없음</li>
            ) : (
              draft.syncJobs.map((job) => (
                <li key={job.id}>
                  [{job.type}] {job.status} — {job.message ?? "-"}
                </li>
              ))
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
