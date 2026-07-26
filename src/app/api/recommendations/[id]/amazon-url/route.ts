import { NextResponse } from "next/server";
import { applyAmazonUrlToRecommendation } from "@/lib/discover/apply-amazon-url";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = (await request.json()) as {
      url?: string;
      costUsd?: number | string;
    };

    const url = body.url?.trim();
    if (!url) {
      return NextResponse.json(
        { error: "url(Amazon 상품 URL 또는 ASIN)이 필요합니다." },
        { status: 400 },
      );
    }

    let costUsd: number | undefined;
    if (body.costUsd != null && body.costUsd !== "") {
      const n = Number(body.costUsd);
      if (!Number.isFinite(n) || n <= 0) {
        return NextResponse.json(
          { error: "costUsd는 0보다 큰 숫자여야 합니다." },
          { status: 400 },
        );
      }
      costUsd = n;
    }

    const result = await applyAmazonUrlToRecommendation(id, { url, costUsd });

    return NextResponse.json({
      ok: true,
      recommendationId: result.recommendation.id,
      productId: result.product.id,
      asin: result.fetched.asin,
      sourceUrl: result.fetched.sourceUrl,
      sourcePriceUsd: result.fetched.sourcePrice,
      salePriceKrw: result.priced.salePriceKrw,
      costKrw: result.priced.costKrw,
      score: result.score,
      label: result.label,
      isFallback: result.isFallback,
      marketVerdict: result.market.marketVerdict?.code ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Amazon URL 적용 실패",
      },
      { status: 400 },
    );
  }
}
