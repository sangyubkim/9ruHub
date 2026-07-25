import { afterEach, describe, expect, it, vi } from "vitest";
import {
  credentialWarningMessages,
  getChannelCredentialStatus,
  isCoupangConfigured,
  isSmartStoreConfigured,
} from "./credentials";

describe("credentials", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("미설정 시 스텁 경고를 반환한다", () => {
    vi.stubEnv("SMARTSTORE_CLIENT_ID", "");
    vi.stubEnv("SMARTSTORE_CLIENT_SECRET", "");
    vi.stubEnv("COUPANG_ACCESS_KEY", "");
    vi.stubEnv("COUPANG_SECRET_KEY", "");
    vi.stubEnv("COUPANG_VENDOR_ID", "");

    expect(isSmartStoreConfigured()).toBe(false);
    expect(isCoupangConfigured()).toBe(false);
    const warnings = credentialWarningMessages(getChannelCredentialStatus());
    expect(warnings.some((w) => w.includes("스마트스토어"))).toBe(true);
    expect(warnings.some((w) => w.includes("쿠팡"))).toBe(true);
  });

  it("인증키만 있고 상품 env가 없으면 productReady=false", () => {
    vi.stubEnv("SMARTSTORE_CLIENT_ID", "id");
    vi.stubEnv("SMARTSTORE_CLIENT_SECRET", "secret");
    vi.stubEnv("SMARTSTORE_LEAF_CATEGORY_ID", "");
    vi.stubEnv("COUPANG_ACCESS_KEY", "ak");
    vi.stubEnv("COUPANG_SECRET_KEY", "sk");
    vi.stubEnv("COUPANG_VENDOR_ID", "A1");
    vi.stubEnv("COUPANG_DISPLAY_CATEGORY_CODE", "");

    const status = getChannelCredentialStatus();
    expect(status.smartstore.configured).toBe(true);
    expect(status.smartstore.productReady).toBe(false);
    expect(status.coupang.configured).toBe(true);
    expect(status.coupang.productReady).toBe(false);
  });
});
