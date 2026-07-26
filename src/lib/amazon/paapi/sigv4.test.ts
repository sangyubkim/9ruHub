import { describe, expect, it } from "vitest";
import { signPaapiPostRequest, __test } from "./sigv4";

describe("signPaapiPostRequest", () => {
  it("builds AWS4 authorization header", () => {
    const headers = signPaapiPostRequest({
      accessKey: "AKIAEXAMPLE",
      secretKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
      host: "webservices.amazon.com",
      region: "us-east-1",
      path: "/paapi5/getitems",
      amzTarget: "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems",
      payload: '{"ItemIds":["B00TEST"]}',
      amzDate: "20260726T120000Z",
    });
    expect(headers["x-amz-date"]).toBe("20260726T120000Z");
    expect(headers.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=/);
    expect(headers.authorization).toContain("SignedHeaders=");
    expect(headers.authorization).toContain("Signature=");
    expect(__test.sha256Hex("abc")).toHaveLength(64);
  });
});
