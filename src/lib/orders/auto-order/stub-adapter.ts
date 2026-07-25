import type {
  ForwarderAddress,
  Mall1688Adapter,
  Mall1688AdapterResult,
  Mall1688CartItem,
} from "@/lib/orders/auto-order/types";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 안전한 1688 스텁: 실결제/자격증명 없이 지연·성공만 시뮬레이션.
 */
export class StubMall1688Adapter implements Mall1688Adapter {
  readonly name = "stub-1688-pipeline";
  readonly mode = "stub" as const;

  private async ok(
    message: string,
    payload?: Record<string, unknown>,
  ): Promise<Mall1688AdapterResult> {
    const waitMs = Number(process.env.AUTO_ORDER_STUB_DELAY_MS ?? "40");
    if (waitMs > 0) await delay(Math.min(waitMs, 2000));
    return {
      success: true,
      mode: "stub",
      ref: `STUB-${Date.now()}`,
      message,
      payload: {
        adapter: this.name,
        recordedAt: new Date().toISOString(),
        ...payload,
      },
    };
  }

  async addToCart(items: Mall1688CartItem[]): Promise<Mall1688AdapterResult> {
    return this.ok("1688 장바구니 담기 스텁 완료(실연동 없음).", {
      itemCount: items.length,
      items: items.map((i) => ({
        orderItemId: i.orderItemId,
        title: i.title,
        quantity: i.quantity,
        sourceUrl: i.sourceUrl ?? null,
      })),
    });
  }

  async checkout(orderId: string): Promise<Mall1688AdapterResult> {
    return this.ok("1688 체크아웃 준비 스텁(결제 미실행).", { orderId });
  }

  async pay(
    orderId: string,
    opts: { confirmPayment: true },
  ): Promise<Mall1688AdapterResult> {
    if (opts.confirmPayment !== true) {
      throw new Error("결제 스텁도 confirmPayment: true 가 필요합니다.");
    }
    return this.ok("1688 결제 스텁 기록(실결제 없음).", {
      orderId,
      confirmPayment: true,
    });
  }

  async setForwarderAddress(
    orderId: string,
    address: ForwarderAddress,
  ): Promise<Mall1688AdapterResult> {
    return this.ok("배대지 주소 입력 스텁 완료.", {
      orderId,
      address: {
        name: address.name,
        city: address.city,
        address1: address.address1,
        postalCode: address.postalCode,
      },
    });
  }

  async complete(orderId: string): Promise<Mall1688AdapterResult> {
    return this.ok("1688 주문 완료 스텁.", { orderId });
  }
}
