import { SupplyMall } from "@/generated/prisma/client";
import type { SupplyMallAdapter, SupplyOffer } from "@/lib/discover/types";

/** 타오바오 확장 스텁 — MVP 미사용 */
export class TaobaoSupplyStubAdapter implements SupplyMallAdapter {
  readonly name = "taobao-supply-stub";
  readonly mall = SupplyMall.TAOBAO;

  async fetchSupplyOffers(_keyword: string, _limit?: number): Promise<SupplyOffer[]> {
    return [];
  }
}
