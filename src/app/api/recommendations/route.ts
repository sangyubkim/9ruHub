import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  createRecommendationFromUrl,
  generateRecommendationsForTenant,
} from "@/lib/recommend/engine";
import { getDefaultTenantId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET() {
  const tenantId = await getDefaultTenantId();
  const items = await prisma.aiRecommendation.findMany({
    where: { tenantId },
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
    include: {
      product: true,
      draft: { select: { id: true, status: true } },
    },
    take: 100,
  });
  return NextResponse.json({ tenantId, items });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      url?: string;
      generate?: boolean;
      limit?: number;
      minScore?: number;
    };

    if (body.url?.trim()) {
      const item = await createRecommendationFromUrl(body.url.trim());
      return NextResponse.json({ item }, { status: 201 });
    }

    const result = await generateRecommendationsForTenant({
      limit: body.limit,
      minScore: body.minScore,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "추천 생성 실패" },
      { status: 400 },
    );
  }
}
