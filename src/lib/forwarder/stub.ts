import type {
  ForwarderAdapter,
  ForwarderCreateRequest,
  ForwarderCreateResult,
  ForwarderTrackResult,
} from "@/lib/forwarder/types";

export class StubForwarderAdapter implements ForwarderAdapter {
  readonly name = "stub-forwarder";

  async createInbound(
    req: ForwarderCreateRequest,
  ): Promise<ForwarderCreateResult> {
    const trackingNo = `FWD-${req.shipmentId.slice(0, 8)}-${Date.now()}`;
    return {
      success: true,
      mode: "stub",
      forwarderCode: this.name,
      trackingNo,
      message: "배대지 입고 예약 스텁 완료(실연동 없음).",
      payload: {
        orderId: req.orderId,
        shipmentId: req.shipmentId,
        customerName: req.customerName ?? null,
        weightGrams: req.weightGrams ?? null,
        recordedAt: new Date().toISOString(),
      },
    };
  }

  async track(trackingNo: string): Promise<ForwarderTrackResult> {
    return {
      success: true,
      mode: "stub",
      status: "IN_TRANSIT",
      events: [
        {
          at: new Date().toISOString(),
          description: `스텁 추적: ${trackingNo} 국제운송 중`,
        },
      ],
      message: "배대지 추적 스텁 응답",
    };
  }
}
