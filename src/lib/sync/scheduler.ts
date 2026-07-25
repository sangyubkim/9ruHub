import { DraftStatus, ListingStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { syncDraftPriceStock } from "./workflow";

export type SchedulerResultItem = {
  draftId: string;
  ok: boolean;
  salePriceKrw?: number;
  inStock?: boolean;
  error?: string;
};

export type SchedulerResult = {
  startedAt: string;
  finishedAt: string;
  scanned: number;
  succeeded: number;
  failed: number;
  items: SchedulerResultItem[];
};

/**
 * LIVE 리스팅이 있는 PUBLISHED 초안을 순서대로 가격·재고 동기화
 */
export async function syncAllLiveDrafts(options?: {
  limit?: number;
}): Promise<SchedulerResult> {
  const limit = options?.limit ?? Number(process.env.SYNC_BATCH_LIMIT ?? "50");
  const startedAt = new Date();

  const drafts = await prisma.productDraft.findMany({
    where: {
      status: DraftStatus.PUBLISHED,
      listings: { some: { status: ListingStatus.LIVE } },
    },
    select: { id: true },
    orderBy: { updatedAt: "asc" },
    take: Number.isFinite(limit) && limit > 0 ? limit : 50,
  });

  const items: SchedulerResultItem[] = [];

  for (const draft of drafts) {
    try {
      const result = await syncDraftPriceStock(draft.id);
      items.push({
        draftId: draft.id,
        ok: true,
        salePriceKrw: result.salePriceKrw,
        inStock: result.inStock,
      });
    } catch (error) {
      items.push({
        draftId: draft.id,
        ok: false,
        error: error instanceof Error ? error.message : "동기화 실패",
      });
    }
  }

  const finishedAt = new Date();
  return {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    scanned: drafts.length,
    succeeded: items.filter((i) => i.ok).length,
    failed: items.filter((i) => !i.ok).length,
    items,
  };
}
