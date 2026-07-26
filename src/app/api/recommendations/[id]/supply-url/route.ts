import { NextResponse } from "next/server";
import { apply1688SupplyUrlToRecommendation } from "@/lib/discover/apply-supply-url";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = (await request.json()) as {
      supplyUrl?: string;
      costPriceCny?: number | string;
    };

    const supplyUrl = body.supplyUrl?.trim();
    if (!supplyUrl) {
      return NextResponse.json(
        { error: "supplyUrl(1688 상품 URL)이 필요합니다." },
        { status: 400 },
      );
    }

    let costPriceCny: number | undefined;
    if (body.costPriceCny != null && body.costPriceCny !== "") {
      const n = Number(body.costPriceCny);
      if (!Number.isFinite(n) || n <= 0) {
        return NextResponse.json(
          { error: "costPriceCny는 0보다 큰 숫자여야 합니다." },
          { status: 400 },
        );
      }
      costPriceCny = n;
    }

    const result = await apply1688SupplyUrlToRecommendation(id, {
      supplyUrl,
      costPriceCny,
    });

    return NextResponse.json({
      ok: true,
      isStub: result.candidate.isStub,
      costPriceCny: result.offer.costPriceCny,
      sellPriceKrw: result.metrics.sellPriceKrw,
      marginRate: result.metrics.marginRate,
      score: result.breakdown.total,
      label: result.breakdown.label,
      supplyUrl: result.offer.supplyUrl,
      isFallback: result.offer.isFallback,
      fetchError: result.offer.fetchError,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "1688 실원가 적용 실패",
      },
      { status: 400 },
    );
  }
}
