import type {
  ChinaMallAdapter,
  ChinaMallPurchaseRequest,
  ChinaMallPurchaseResult,
} from "@/lib/china-mall/types";

/**
 * 1688 등 공식 API가 없거나 키가 없을 때 사용하는 안전한 스텁.
 * 실제 결제를 수행하지 않고 구매 시도만 기록한다.
 */
export class StubChinaMallAdapter implements ChinaMallAdapter {
  readonly name = "stub-1688";

  async purchase(
    request: ChinaMallPurchaseRequest,
  ): Promise<ChinaMallPurchaseResult> {
    const purchaseRef = `STUB-${request.orderItemId.slice(0, 8)}-${Date.now()}`;
    return {
      success: true,
      mode: "stub",
      purchaseRef,
      status: "STUBBED",
      message: "중국몰 자동주문 스텁: 구매 요청을 기록했습니다(실결제 없음).",
      payload: {
        adapter: this.name,
        title: request.title,
        quantity: request.quantity,
        sourceUrl: request.sourceUrl ?? null,
        maxCostKrw: request.maxCostKrw ?? null,
        note: request.note ?? null,
        recordedAt: new Date().toISOString(),
      },
    };
  }
}
