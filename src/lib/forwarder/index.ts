import { StubForwarderAdapter } from "@/lib/forwarder/stub";
import type { ForwarderAdapter } from "@/lib/forwarder/types";

export function getForwarderAdapter(): ForwarderAdapter {
  const mode = (process.env.FORWARDER_ADAPTER ?? "stub").toLowerCase();
  const hasKey = Boolean(process.env.FORWARDER_API_KEY?.trim());
  if (mode === "live" && hasKey) {
    console.warn("FORWARDER live 요청이나 공식 어댑터 미구현 → stub 폴백");
  }
  return new StubForwarderAdapter();
}

export type {
  ForwarderAdapter,
  ForwarderCreateRequest,
  ForwarderCreateResult,
  ForwarderTrackResult,
} from "@/lib/forwarder/types";
