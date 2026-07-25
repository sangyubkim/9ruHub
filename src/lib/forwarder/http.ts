import type {
  ForwarderAdapter,
  ForwarderCreateRequest,
  ForwarderCreateResult,
  ForwarderPollResult,
  ForwarderTrackResult,
  ForwarderTrackingFetchResult,
} from "@/lib/forwarder/types";

/**
 * 배대지 HTTP 스켈레톤.
 * FORWARDER_API_URL(또는 BASE) + FORWARDER_API_KEY 있을 때만 사용.
 * 응답 스키마는 벤더별 차이가 크므로, 실패 시 명확한 메시지로 반환한다.
 */
export class HttpForwarderAdapter implements ForwarderAdapter {
  readonly name = "http-forwarder";
  private readonly fetchImpl: typeof fetch;

  constructor(fetchImpl: typeof fetch = fetch) {
    this.fetchImpl = fetchImpl;
  }

  private baseUrl(): string {
    const url =
      process.env.FORWARDER_API_URL?.trim() ||
      process.env.FORWARDER_API_BASE?.trim();
    if (!url) throw new Error("FORWARDER_API_URL / FORWARDER_API_BASE 필요");
    return url.replace(/\/$/, "");
  }

  private apiKey(): string {
    const key = process.env.FORWARDER_API_KEY?.trim();
    if (!key) throw new Error("FORWARDER_API_KEY 필요");
    return key;
  }

  private async request(
    path: string,
    init: RequestInit,
  ): Promise<{ status: number; body: unknown }> {
    const res = await this.fetchImpl(`${this.baseUrl()}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey()}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    const text = await res.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = { raw: text };
      }
    }
    return { status: res.status, body };
  }

  async createInbound(
    req: ForwarderCreateRequest,
  ): Promise<ForwarderCreateResult> {
    const { status, body } = await this.request("/v1/inbound", {
      method: "POST",
      body: JSON.stringify(req),
    });
    if (status < 200 || status >= 300) {
      return {
        success: false,
        mode: "live",
        forwarderCode: this.name,
        trackingNo: "",
        message: `배대지 입고 예약 실패 (HTTP ${status})`,
        payload: { status, body },
      };
    }
    const row = (body ?? {}) as {
      trackingNo?: string;
      forwarderCode?: string;
      message?: string;
    };
    return {
      success: true,
      mode: "live",
      forwarderCode: row.forwarderCode ?? this.name,
      trackingNo: row.trackingNo ?? "",
      message: row.message ?? "배대지 입고 예약 완료",
      payload: { body },
    };
  }

  async track(trackingNo: string): Promise<ForwarderTrackResult> {
    const { status, body } = await this.request(
      `/v1/track/${encodeURIComponent(trackingNo)}`,
      { method: "GET" },
    );
    if (status < 200 || status >= 300) {
      return {
        success: false,
        mode: "live",
        status: "EXCEPTION",
        events: [],
        message: `배대지 추적 실패 (HTTP ${status})`,
      };
    }
    const row = (body ?? {}) as {
      status?: ForwarderTrackResult["status"];
      events?: ForwarderTrackResult["events"];
      message?: string;
      localCarrier?: string;
      localTrackingNo?: string;
    };
    return {
      success: true,
      mode: "live",
      status: row.status ?? "IN_TRANSIT",
      events: row.events ?? [],
      message: row.message ?? "배대지 추적 응답",
      localCarrier: row.localCarrier,
      localTrackingNo: row.localTrackingNo,
    };
  }

  async pollInbound(
    shipmentId: string,
    forwarderTrackingNo?: string | null,
  ): Promise<ForwarderPollResult> {
    const { status, body } = await this.request("/v1/inbound/poll", {
      method: "POST",
      body: JSON.stringify({ shipmentId, forwarderTrackingNo }),
    });
    if (status < 200 || status >= 300) {
      return {
        success: false,
        mode: "live",
        status: "EXCEPTION",
        events: [],
        message: `입고 확인 실패 (HTTP ${status})`,
        payload: { body },
      };
    }
    const row = (body ?? {}) as Partial<ForwarderPollResult>;
    return {
      success: true,
      mode: "live",
      status: row.status ?? "AT_FORWARDER",
      message: row.message ?? "입고 확인",
      events: row.events ?? [],
      forwarderTrackingNo: row.forwarderTrackingNo ?? forwarderTrackingNo,
      payload: { body },
    };
  }

  async pollOutbound(
    shipmentId: string,
    forwarderTrackingNo?: string | null,
  ): Promise<ForwarderPollResult> {
    const { status, body } = await this.request("/v1/outbound/poll", {
      method: "POST",
      body: JSON.stringify({ shipmentId, forwarderTrackingNo }),
    });
    if (status < 200 || status >= 300) {
      return {
        success: false,
        mode: "live",
        status: "EXCEPTION",
        events: [],
        message: `출고 확인 실패 (HTTP ${status})`,
        payload: { body },
      };
    }
    const row = (body ?? {}) as Partial<ForwarderPollResult>;
    return {
      success: true,
      mode: "live",
      status: row.status ?? "IN_TRANSIT",
      message: row.message ?? "출고 확인",
      events: row.events ?? [],
      forwarderTrackingNo: row.forwarderTrackingNo ?? forwarderTrackingNo,
      localCarrier: row.localCarrier,
      localTrackingNo: row.localTrackingNo,
      payload: { body },
    };
  }

  async fetchTrackingNumber(
    shipmentId: string,
    forwarderTrackingNo?: string | null,
  ): Promise<ForwarderTrackingFetchResult> {
    const { status, body } = await this.request("/v1/tracking", {
      method: "POST",
      body: JSON.stringify({ shipmentId, forwarderTrackingNo }),
    });
    if (status < 200 || status >= 300) {
      return {
        success: false,
        mode: "live",
        localCarrier: "",
        localTrackingNo: "",
        message: `송장 수집 실패 (HTTP ${status})`,
        payload: { body },
      };
    }
    const row = (body ?? {}) as {
      localCarrier?: string;
      localTrackingNo?: string;
      message?: string;
    };
    return {
      success: Boolean(row.localTrackingNo),
      mode: "live",
      localCarrier: row.localCarrier ?? "",
      localTrackingNo: row.localTrackingNo ?? "",
      message: row.message ?? "송장 수집",
      payload: { body },
    };
  }
}

export function isForwarderLiveConfigured(): boolean {
  const mode = (process.env.FORWARDER_ADAPTER ?? "stub").toLowerCase();
  const hasUrl = Boolean(
    process.env.FORWARDER_API_URL?.trim() ||
      process.env.FORWARDER_API_BASE?.trim(),
  );
  const hasKey = Boolean(process.env.FORWARDER_API_KEY?.trim());
  return mode === "live" && hasUrl && hasKey;
}
