import type {
  InvoiceRegisterAdapter,
  InvoiceRegisterRequest,
  InvoiceRegisterResult,
} from "@/lib/invoice/types";

/**
 * 스마트스토어/쿠팡 송장 자동등록 스텁.
 * 채널 키가 있어도 송장 전용 live 어댑터가 없으면 안전하게 기록만 수행.
 */
export class StubInvoiceRegisterAdapter implements InvoiceRegisterAdapter {
  readonly name = "stub-channel-invoice";

  async register(
    req: InvoiceRegisterRequest,
  ): Promise<InvoiceRegisterResult> {
    return {
      success: true,
      mode: "stub",
      status: "STUBBED",
      message: `${req.channel} 송장 자동등록 스텁 완료`,
      payload: {
        channel: req.channel,
        orderExternalId: req.orderExternalId ?? null,
        localCarrier: req.localCarrier,
        localTrackingNo: req.localTrackingNo,
        recordedAt: new Date().toISOString(),
      },
    };
  }
}
