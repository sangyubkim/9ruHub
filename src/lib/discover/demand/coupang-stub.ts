import { DemandMall } from "@/generated/prisma/client";
import type { DemandMallAdapter, DemandMetrics } from "@/lib/discover/types";

/**
 * 쿠팡 수요 확장 스텁 — MVP에서는 사용하지 않음.
 */
export class CoupangDemandStubAdapter implements DemandMallAdapter {
  readonly name = "coupang-demand-stub";
  readonly mall = DemandMall.COUPANG;

  async fetchDemand(keyword: string): Promise<DemandMetrics> {
    return {
      mall: DemandMall.COUPANG,
      keyword: keyword.trim(),
      title: `[쿠팡 스텁] ${keyword.trim()}`,
      demandUrl: null,
      externalDemandId: `coupang-stub-${keyword.trim()}`,
      searchVolume: 0,
      competition: 1,
      reviewCount: 0,
      rating: 0,
      salesEstimate: 0,
      seasonalityScore: 0,
      isStub: true,
      raw: {
        provider: this.name,
        extension: true,
        note: "Coupang demand adapter not implemented — extension stub only",
      },
    };
  }
}
