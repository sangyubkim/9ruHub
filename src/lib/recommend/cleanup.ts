import { RecommendationStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getDefaultTenantId } from "@/lib/tenant";

export type CleanupMode =
  | "pending"
  | "pending_stub"
  | "keep_top"
  | "pending_except_ids"
  | "purge_ignored";

/**
 * 추천 목록 정리 — DRAFT_CREATED/ACCEPTED/CONVERTED 는 건드리지 않음.
 * PENDING 만 IGNORED 로 보냄.
 */
export async function cleanupRecommendations(options: {
  mode: CleanupMode;
  tenantId?: string;
  /** keep_top: 점수 상위 N개만 남김 */
  keepTop?: number;
  /** pending_except_ids: 이 ID는 유지 */
  exceptIds?: string[];
  /** candidate 있는 발굴 추천만 */
  discoverOnly?: boolean;
}) {
  const tenantId = options.tenantId ?? (await getDefaultTenantId());
  const discoverOnly = options.discoverOnly ?? false;
  const now = new Date();

  const baseWhere = {
    tenantId,
    status: RecommendationStatus.PENDING,
    ...(discoverOnly ? { candidateId: { not: null } } : {}),
  };

  if (options.mode === "pending") {
    const result = await prisma.aiRecommendation.updateMany({
      where: baseWhere,
      data: { status: RecommendationStatus.IGNORED, ignoredAt: now },
    });
    return { mode: options.mode, ignored: result.count, kept: 0 };
  }

  if (options.mode === "pending_stub") {
    const stubs = await prisma.aiRecommendation.findMany({
      where: {
        ...baseWhere,
        candidate: { isStub: true },
      },
      select: { id: true },
    });
    if (stubs.length === 0) {
      return { mode: options.mode, ignored: 0, kept: 0 };
    }
    const result = await prisma.aiRecommendation.updateMany({
      where: { id: { in: stubs.map((s) => s.id) } },
      data: { status: RecommendationStatus.IGNORED, ignoredAt: now },
    });
    return { mode: options.mode, ignored: result.count, kept: 0 };
  }

  if (options.mode === "pending_except_ids") {
    const except = new Set(options.exceptIds ?? []);
    const pending = await prisma.aiRecommendation.findMany({
      where: baseWhere,
      select: { id: true },
    });
    const toIgnore = pending.filter((p) => !except.has(p.id)).map((p) => p.id);
    if (toIgnore.length === 0) {
      return {
        mode: options.mode,
        ignored: 0,
        kept: pending.length,
      };
    }
    const result = await prisma.aiRecommendation.updateMany({
      where: { id: { in: toIgnore } },
      data: { status: RecommendationStatus.IGNORED, ignoredAt: now },
    });
    return {
      mode: options.mode,
      ignored: result.count,
      kept: pending.length - result.count,
    };
  }

  if (options.mode === "purge_ignored") {
    const ignored = await prisma.aiRecommendation.findMany({
      where: {
        tenantId,
        status: RecommendationStatus.IGNORED,
        ...(discoverOnly ? { candidateId: { not: null } } : {}),
      },
      select: { id: true, candidateId: true },
    });
    if (ignored.length === 0) {
      return { mode: options.mode, ignored: 0, kept: 0, deleted: 0 };
    }

    const deleted = await prisma.aiRecommendation.deleteMany({
      where: { id: { in: ignored.map((r) => r.id) } },
    });

    // 다른 추천이 없는 발굴 후보도 정리
    const candidateIds = [
      ...new Set(
        ignored
          .map((r) => r.candidateId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    let candidatesDeleted = 0;
    for (const candidateId of candidateIds) {
      const stillLinked = await prisma.aiRecommendation.count({
        where: { candidateId },
      });
      if (stillLinked === 0) {
        await prisma.productCandidate.delete({ where: { id: candidateId } });
        candidatesDeleted += 1;
      }
    }

    return {
      mode: options.mode,
      ignored: 0,
      kept: 0,
      deleted: deleted.count,
      candidatesDeleted,
    };
  }

  // keep_top
  const keepTop = Math.max(1, options.keepTop ?? 20);
  const pending = await prisma.aiRecommendation.findMany({
    where: baseWhere,
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
    select: { id: true },
  });
  const keepIds = pending.slice(0, keepTop).map((p) => p.id);
  const dropIds = pending.slice(keepTop).map((p) => p.id);
  if (dropIds.length === 0) {
    return { mode: options.mode, ignored: 0, kept: keepIds.length };
  }
  const result = await prisma.aiRecommendation.updateMany({
    where: { id: { in: dropIds } },
    data: { status: RecommendationStatus.IGNORED, ignoredAt: now },
  });
  return {
    mode: options.mode,
    ignored: result.count,
    kept: keepIds.length,
  };
}

/**
 * 추천 1건 하드 삭제.
 * - 연결된 초안/상품은 삭제하지 않음 (관계 SetNull)
 * - 다른 추천이 없는 발굴 후보는 함께 삭제
 */
export async function deleteRecommendation(
  recommendationId: string,
  tenantId?: string,
) {
  const resolvedTenantId = tenantId ?? (await getDefaultTenantId());
  const rec = await prisma.aiRecommendation.findFirst({
    where: { id: recommendationId, tenantId: resolvedTenantId },
    select: {
      id: true,
      status: true,
      candidateId: true,
      draftId: true,
    },
  });
  if (!rec) throw new Error("추천을 찾을 수 없습니다.");

  // 초안이 연결된 활성 추천은 실수 방지 — IGNORED 또는 PENDING만 삭제 허용
  if (
    rec.status === RecommendationStatus.DRAFT_CREATED ||
    rec.status === RecommendationStatus.CONVERTED ||
    rec.status === RecommendationStatus.ACCEPTED
  ) {
    throw new Error(
      `초안/전환된 추천은 삭제할 수 없습니다 (${rec.status}). 먼저 무시하거나 초안만 관리하세요.`,
    );
  }

  await prisma.aiRecommendation.delete({ where: { id: rec.id } });

  let candidateDeleted = false;
  if (rec.candidateId) {
    const stillLinked = await prisma.aiRecommendation.count({
      where: { candidateId: rec.candidateId },
    });
    if (stillLinked === 0) {
      await prisma.productCandidate.delete({
        where: { id: rec.candidateId },
      });
      candidateDeleted = true;
    }
  }

  return { id: rec.id, candidateDeleted };
}
