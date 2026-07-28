import { NextResponse } from "next/server";
import { applyAmazonUrlToRecommendation } from "@/lib/discover/apply-amazon-url";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function parsePositiveNumber(
  value: number | string | undefined,
  field: string,
): number | undefined {
  if (value == null || value === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${field}는 0보다 큰 숫자여야 합니다.`);
  }
  return n;
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = (await request.json()) as {
      url?: string;
      costUsd?: number | string;
      weightGrams?: number | string;
    };

    const url = body.url?.trim() || undefined;
    let costUsd: number | undefined;
    let weightGrams: number | undefined;
    try {
      costUsd = parsePositiveNumber(body.costUsd, "costUsd");
      weightGrams = parsePositiveNumber(body.weightGrams, "weightGrams");
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "입력값 오류" },
        { status: 400 },
      );
    }

    const result = await applyAmazonUrlToRecommendation(id, {
      url,
      costUsd,
      weightGrams,
    });

    return NextResponse.json({
      ok: true,
      recommendationId: result.recommendation.id,
      productId: result.product.id,
      asin: result.fetched.asin,
      sourceUrl: result.fetched.sourceUrl,
      sourcePriceUsd: result.fetched.sourcePrice,
      weightGrams: result.fetched.weightGrams ?? null,
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
