import { afterEach, describe, expect, it } from "vitest";
import {
  clearSmartStoreTokenCache,
  fetchSmartStoreAccessToken,
  generateSmartStoreSignature,
} from "./smartstore-auth";

describe("smartstore-auth", () => {
  afterEach(() => {
    clearSmartStoreTokenCache();
    delete process.env.SMARTSTORE_CLIENT_ID;
    delete process.env.SMARTSTORE_CLIENT_SECRET;
    delete process.env.SMARTSTORE_TOKEN_TYPE;
    delete process.env.SMARTSTORE_ACCOUNT_ID;
  });

  it("client_id_timestamp 를 bcrypt+base64 로 서명한다", () => {
    const clientId = "aaaabbbbcccc";
    const clientSecret = "$2a$10$abcdefghijklmnopqrstuv";
    const timestamp = 1643961623299;
    const sign = generateSmartStoreSignature(clientId, clientSecret, timestamp);
    expect(sign.length).toBeGreaterThan(20);
    expect(Buffer.from(sign, "base64").toString("utf-8")).toContain("$2a$");
  });

  it("토큰 API를 호출하고 access_token 을 캐시한다", async () => {
    process.env.SMARTSTORE_CLIENT_ID = "client";
    process.env.SMARTSTORE_CLIENT_SECRET = "$2a$10$abcdefghijklmnopqrstuv";

    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return new Response(
        JSON.stringify({ access_token: "tok-1", expires_in: 3600 }),
        { status: 200 },
      );
    };

    const t1 = await fetchSmartStoreAccessToken(fetchImpl);
    const t2 = await fetchSmartStoreAccessToken(fetchImpl);
    expect(t1).toBe("tok-1");
    expect(t2).toBe("tok-1");
    expect(calls).toBe(1);
  });
});
