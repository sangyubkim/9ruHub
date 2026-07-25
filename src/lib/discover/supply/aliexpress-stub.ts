import { SupplyMall } from "@/generated/prisma/client";
import type { SupplyMallAdapter, SupplyOffer } from "@/lib/discover/types";

/** AliExpress 확장 스텁 — MVP 미사용 */
export class AliExpressSupplyStubAdapter implements SupplyMallAdapter {
  readonly name = "aliexpress-supply-stub";
  readonly mall = SupplyMall.ALIEXPRESS;

  async fetchSupplyOffers(_keyword: string, _limit?: number): Promise<SupplyOffer[]> {
    return [];
  }
}
