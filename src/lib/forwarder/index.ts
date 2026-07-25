import { HttpForwarderAdapter, isForwarderLiveConfigured } from "@/lib/forwarder/http";
import { StubForwarderAdapter } from "@/lib/forwarder/stub";
import type { ForwarderAdapter } from "@/lib/forwarder/types";

export function getForwarderAdapter(): ForwarderAdapter {
  if (isForwarderLiveConfigured()) {
    return new HttpForwarderAdapter();
  }
  return new StubForwarderAdapter();
}

export type {
  ForwarderAdapter,
  ForwarderCreateRequest,
  ForwarderCreateResult,
  ForwarderPollResult,
  ForwarderTrackResult,
  ForwarderTrackingFetchResult,
} from "@/lib/forwarder/types";
export { stubForwarderTrackingNo, stubLocalTracking } from "@/lib/forwarder/stub";
export { isForwarderLiveConfigured } from "@/lib/forwarder/http";
