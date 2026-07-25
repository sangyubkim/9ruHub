import { LiveHookMall1688Adapter } from "@/lib/orders/auto-order/live-hook";
import { StubMall1688Adapter } from "@/lib/orders/auto-order/stub-adapter";
import type { Mall1688Adapter } from "@/lib/orders/auto-order/types";

/**
 * AUTO_ORDER_ADAPTER=stub|live-hook (기본 stub)
 * live-hook은 Playwright/API 자리이며, 미구성 시 안전 스텁으로 폴백한다.
 */
export function getMall1688Adapter(): Mall1688Adapter {
  const mode = (
    process.env.AUTO_ORDER_ADAPTER ??
    process.env.CHINA_MALL_ADAPTER ??
    "stub"
  ).toLowerCase();

  if (mode === "live" || mode === "live-hook" || mode === "playwright") {
    if (process.env.AUTO_ORDER_LIVE === "true") {
      return new LiveHookMall1688Adapter();
    }
    console.warn(
      "[auto-order] live 어댑터 요청이었으나 AUTO_ORDER_LIVE!=true → stub",
    );
  }

  return new StubMall1688Adapter();
}
