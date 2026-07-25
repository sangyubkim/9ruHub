import { StubChinaMallAdapter } from "@/lib/china-mall/stub";
import type { ChinaMallAdapter } from "@/lib/china-mall/types";

/**
 * 공식 API 키가 있고 CHINA_MALL_ADAPTER=live 일 때만 live 경로를 열 자리.
 * 현재는 안전상 항상 스텁(또는 명시적 stub).
 */
export function getChinaMallAdapter(): ChinaMallAdapter {
  const mode = (process.env.CHINA_MALL_ADAPTER ?? "stub").toLowerCase();
  const hasKey = Boolean(process.env.CHINA_MALL_API_KEY?.trim());

  if (mode === "live" && hasKey) {
    // 공식 연동 훅이 준비되면 여기서 LiveChinaMallAdapter 반환
    console.warn(
      "CHINA_MALL live 요청이었으나 공식 어댑터가 없어 stub으로 폴백합니다.",
    );
  }

  return new StubChinaMallAdapter();
}

export type { ChinaMallAdapter, ChinaMallPurchaseRequest, ChinaMallPurchaseResult } from "@/lib/china-mall/types";
