import { NextResponse } from "next/server";
import { discoverByKeyword } from "@/lib/discover/engine";
import { prisma } from "@/lib/db";
import { getDefaultTenantId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET() {
  const tenantId = await getDefaultTenantId();
  const candidates = await prisma.productCandidate.findMany({
    where: { tenantId },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      recommendations: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          score: true,
          reasonCode: true,
          reasonText: true,
          status: true,
          draftId: true,
        },
      },
    },
  });
  return NextResponse.json({ tenantId, candidates });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      keyword?: string;
      supplyLimit?: number;
      minScore?: number;
    };

    const keyword = body.keyword?.trim();
    if (!keyword) {
      return NextResponse.json(
        { error: "keyword가 필요합니다." },
        { status: 400 },
      );
    }

    const result = await discoverByKeyword(keyword, {
      supplyLimit: body.supplyLimit,
      minScore: body.minScore,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "발굴 실패" },
      { status: 400 },
    );
  }
}
