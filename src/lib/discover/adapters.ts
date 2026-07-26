import { CoupangDemandStubAdapter } from "@/lib/discover/demand/coupang-stub";
import {
  NaverDemandLiveAdapter,
  shouldUseNaverLiveDemand,
} from "@/lib/discover/demand/naver-live";
import { NaverDemandStubAdapter } from "@/lib/discover/demand/naver-stub";
import { AliExpressSupplyStubAdapter } from "@/lib/discover/supply/aliexpress-stub";
import { create1688SupplyAdapter } from "@/lib/discover/supply/mall1688-live";
import { TaobaoSupplyStubAdapter } from "@/lib/discover/supply/taobao-stub";
import type { DemandMallAdapter, SupplyMallAdapter } from "@/lib/discover/types";

/** MVP 기본: 네이버 수요 (키 있으면 live, 없으면 stub) */
export function getDemandAdapter(): DemandMallAdapter {
  const mode = (process.env.DISCOVER_DEMAND_ADAPTER ?? "naver").toLowerCase();
  if (mode === "coupang") {
    console.warn("Coupang demand is extension stub only");
    return new CoupangDemandStubAdapter();
  }
  if (shouldUseNaverLiveDemand()) {
    return new NaverDemandLiveAdapter();
  }
  return new NaverDemandStubAdapter();
}

/** MVP 기본: 1688 공급가 (DISCOVER_1688_MODE=auto|live|stub) */
export function getSupplyAdapter(): SupplyMallAdapter {
  const mode = (process.env.DISCOVER_SUPPLY_ADAPTER ?? "1688").toLowerCase();
  if (mode === "aliexpress" || mode === "ali") {
    console.warn("AliExpress supply is extension stub only");
    return new AliExpressSupplyStubAdapter();
  }
  if (mode === "taobao") {
    console.warn("Taobao supply is extension stub only");
    return new TaobaoSupplyStubAdapter();
  }
  return create1688SupplyAdapter();
}
