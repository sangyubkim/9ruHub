import { Channel, ShipmentStatus } from "@/generated/prisma/client";
import { INVOICE_CHANNELS } from "@/lib/channels/invoice";

/** 순수 상태 전이 헬퍼 (단위 테스트용) */
export function nextForwarderSyncAction(
  status: ShipmentStatus,
  hasLocalTracking: boolean,
): "pollInbound" | "pollOutbound" | "fetchTrackingNumber" | "track" | "noop" {
  if (status === ShipmentStatus.PENDING) return "pollInbound";
  if (status === ShipmentStatus.AT_FORWARDER) return "pollOutbound";
  if (
    (status === ShipmentStatus.IN_TRANSIT ||
      status === ShipmentStatus.DELIVERED) &&
    !hasLocalTracking
  ) {
    return "fetchTrackingNumber";
  }
  if (
    status === ShipmentStatus.IN_TRANSIT ||
    status === ShipmentStatus.EXCEPTION
  ) {
    return "track";
  }
  return "noop";
}

export function parseChannelList(input: unknown): Channel[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const allowed = new Set<string>(INVOICE_CHANNELS);
  const channels = input
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.toUpperCase())
    .filter((v): v is Channel => allowed.has(v)) as Channel[];
  return channels.length > 0 ? channels : undefined;
}
