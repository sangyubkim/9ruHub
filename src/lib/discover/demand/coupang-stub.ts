import { DemandMall } from "@/generated/prisma/client";
import {
  assessCoupangDensityProxy,
} from "@/lib/discover/demand/market-signals";
import type { DemandMallAdapter, DemandMetrics } from "@/lib/discover/types";

/**
 * 쿠팡 수요 확장 스텁.
 * 실셀러 API 전 — 키워드 휴리스틱으로 밀도 band만 제공 (Phase D).
 */
export class CoupangDemandStubAdapter implements DemandMallAdapter {
  readonly name = "coupang-demand-stub";
  readonly mall = DemandMall.COUPANG;

  async fetchDemand(keyword: string): Promise<DemandMetrics> {
    const trimmed = keyword.trim();
    const density = assessCoupangDensityProxy({ keyword: trimmed });
    const competition =
      density.estimatedSellerBand === "many"
        ? 0.9
        : density.estimatedSellerBand === "few"
          ? 0.2
          : 0.55;

    return {
      mall: DemandMall.COUPANG,
      keyword: trimmed,
      title: `[쿠팡 추정] ${trimmed}`,
      demandUrl: null,
      externalDemandId: `coupang-stub-${trimmed}`,
      searchVolume: 0,
      competition,
      reviewCount: 0,
      rating: 0,
      salesEstimate: 0,
      seasonalityScore: 0,
      isStub: true,
      raw: {
        provider: this.name,
        extension: true,
        coupangDensity: density.density,
        estimatedSellerBand: density.estimatedSellerBand,
        densityLabel: density.label,
        note: "Coupang seller API not implemented — keyword density proxy only",
        reasons: density.reasons,
      },
    };
  }
}
