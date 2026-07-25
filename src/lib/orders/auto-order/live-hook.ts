import { StubMall1688Adapter } from "@/lib/orders/auto-order/stub-adapter";
import type {
  ForwarderAddress,
  Mall1688Adapter,
  Mall1688AdapterResult,
  Mall1688CartItem,
} from "@/lib/orders/auto-order/types";

/**
 * Playwright/API 라이브 훅 자리.
 * 자격증명·캡차 우회·무확인 결제는 구현하지 않는다.
 * AUTO_ORDER_LIVE=true 여도 키가 없으면 stub으로 폴백하고 live-hook 모드만 표시.
 */
export class LiveHookMall1688Adapter implements Mall1688Adapter {
  readonly name = "live-hook-1688";
  readonly mode = "live-hook" as const;
  private readonly fallback = new StubMall1688Adapter();

  private ensureConfigured(): void {
    const hasKey = Boolean(
      process.env.CHINA_MALL_API_KEY?.trim() ||
        process.env.AUTO_ORDER_PLAYWRIGHT_ENABLED === "true",
    );
    if (!hasKey) {
      console.warn(
        "[auto-order] live-hook 요청이나 CHINA_MALL_API_KEY / AUTO_ORDER_PLAYWRIGHT_ENABLED 미설정 → stub 시뮬레이션",
      );
    }
  }

  private tag(result: Mall1688AdapterResult): Mall1688AdapterResult {
    return {
      ...result,
      mode: "live-hook",
      message: `${result.message} (live-hook 폴백)`,
      payload: {
        ...(result.payload ?? {}),
        liveHook: true,
        configured: Boolean(
          process.env.CHINA_MALL_API_KEY?.trim() ||
            process.env.AUTO_ORDER_PLAYWRIGHT_ENABLED === "true",
        ),
      },
    };
  }

  async addToCart(items: Mall1688CartItem[]): Promise<Mall1688AdapterResult> {
    this.ensureConfigured();
    return this.tag(await this.fallback.addToCart(items));
  }

  async checkout(orderId: string): Promise<Mall1688AdapterResult> {
    this.ensureConfigured();
    return this.tag(await this.fallback.checkout(orderId));
  }

  async pay(
    orderId: string,
    opts: { confirmPayment: true },
  ): Promise<Mall1688AdapterResult> {
    if (opts.confirmPayment !== true) {
      throw new Error("라이브 훅도 confirmPayment: true 가 필요합니다.");
    }
    this.ensureConfigured();
    return this.tag(await this.fallback.pay(orderId, opts));
  }

  async setForwarderAddress(
    orderId: string,
    address: ForwarderAddress,
  ): Promise<Mall1688AdapterResult> {
    this.ensureConfigured();
    return this.tag(await this.fallback.setForwarderAddress(orderId, address));
  }

  async complete(orderId: string): Promise<Mall1688AdapterResult> {
    this.ensureConfigured();
    return this.tag(await this.fallback.complete(orderId));
  }
}
