import { NextResponse } from "next/server";
import { createRecommendationsFromWishlist } from "@/lib/recommend/wishlist-bulk";

export const dynamic = "force-dynamic";

/**
 * 위시리스트(ASIN/Amazon URL 여러 줄) → 추천 일괄 생성.
 * 배송 적합성은 createRecommendationFromUrl 경로에서 best-effort.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      text?: string;
      wishlist?: string;
      delayMs?: number;
    };

    const text = (body.text ?? body.wishlist ?? "").trim();
    if (!text) {
      return NextResponse.json(
        { error: "ASIN 또는 Amazon URL을 한 줄에 하나씩 입력하세요." },
        { status: 400 },
      );
    }

    const result = await createRecommendationsFromWishlist(text, {
      delayMs:
        typeof body.delayMs === "number" && body.delayMs >= 0
          ? Math.min(body.delayMs, 5000)
          : undefined,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "위시리스트 처리 실패",
      },
      { status: 400 },
    );
  }
}
