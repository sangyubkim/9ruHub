import type {
  ForwarderAdapter,
  ForwarderCreateRequest,
  ForwarderCreateResult,
  ForwarderPollResult,
  ForwarderTrackResult,
  ForwarderTrackingFetchResult,
} from "@/lib/forwarder/types";

/** 데모용 결정적 국내 송장 (키 없이 재현 가능) */
export function stubLocalTracking(shipmentId: string): {
  localCarrier: string;
  localTrackingNo: string;
} {
  const token = shipmentId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toUpperCase();
  const pad = String(shipmentId.length).padStart(4, "0");
  return {
    localCarrier: "CJ대한통운",
    localTrackingNo: `KR${token}${pad}`,
  };
}

export function stubForwarderTrackingNo(shipmentId: string): string {
  const token = shipmentId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();
  return `FWD-${token}-STUB`;
}

export class StubForwarderAdapter implements ForwarderAdapter {
  readonly name = "stub-forwarder";

  async createInbound(
    req: ForwarderCreateRequest,
  ): Promise<ForwarderCreateResult> {
    const trackingNo = stubForwarderTrackingNo(req.shipmentId);
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
    const local = stubLocalTracking(trackingNo);
    return {
      success: true,
      mode: "stub",
      status: "IN_TRANSIT",
      events: [
        {
          at: new Date().toISOString(),
          description: `스텁 추적: ${trackingNo} 국제운송/국내배송 중`,
        },
      ],
      message: "배대지 추적 스텁 응답",
      localCarrier: local.localCarrier,
      localTrackingNo: local.localTrackingNo,
    };
  }

  async pollInbound(
    shipmentId: string,
    forwarderTrackingNo?: string | null,
  ): Promise<ForwarderPollResult> {
    const trackingNo =
      forwarderTrackingNo?.trim() || stubForwarderTrackingNo(shipmentId);
    return {
      success: true,
      mode: "stub",
      status: "AT_FORWARDER",
      forwarderTrackingNo: trackingNo,
      message: "배대지 입고 확인(스텁)",
      events: [
        {
          at: new Date().toISOString(),
          description: `입고 확인: ${trackingNo} 센터 도착`,
        },
      ],
      payload: { shipmentId, step: "inbound" },
    };
  }

  async pollOutbound(
    shipmentId: string,
    forwarderTrackingNo?: string | null,
  ): Promise<ForwarderPollResult> {
    const trackingNo =
      forwarderTrackingNo?.trim() || stubForwarderTrackingNo(shipmentId);
    const local = stubLocalTracking(shipmentId);
    return {
      success: true,
      mode: "stub",
      status: "IN_TRANSIT",
      forwarderTrackingNo: trackingNo,
      localCarrier: local.localCarrier,
      localTrackingNo: local.localTrackingNo,
      message: "배대지 출고 확인(스텁) — 국내 송장 발급됨",
      events: [
        {
          at: new Date().toISOString(),
          description: `출고 확인: ${local.localCarrier} ${local.localTrackingNo}`,
        },
      ],
      payload: { shipmentId, step: "outbound" },
    };
  }

  async fetchTrackingNumber(
    shipmentId: string,
    forwarderTrackingNo?: string | null,
  ): Promise<ForwarderTrackingFetchResult> {
    const local = stubLocalTracking(shipmentId);
    return {
      success: true,
      mode: "stub",
      localCarrier: local.localCarrier,
      localTrackingNo: local.localTrackingNo,
      message: "국내 송장번호 수집(스텁)",
      payload: {
        shipmentId,
        forwarderTrackingNo: forwarderTrackingNo ?? null,
        step: "tracking",
      },
    };
  }
}
