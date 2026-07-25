import { describe, expect, it } from "vitest";
import {
  buildCoupangMessage,
  createCoupangAuthorization,
  formatCoupangSignedDate,
} from "./coupang-hmac";

describe("coupang-hmac", () => {
  it("UTC signed-date 포맷은 yyMMddTHHmmssZ", () => {
    const date = new Date(Date.UTC(2024, 0, 2, 3, 4, 5));
    expect(formatCoupangSignedDate(date)).toBe("240102T030405Z");
  });

  it("HMAC 메시지와 Authorization 헤더를 생성한다", () => {
    const signedDate = "240102T030405Z";
    const path = "/v2/providers/seller_api/apis/api/v1/marketplace/seller-products";
    const message = buildCoupangMessage("POST", path, signedDate);
    expect(message).toBe(`240102T030405ZPOST${path}`);

    const { authorization } = createCoupangAuthorization({
      method: "POST",
      pathWithQuery: path,
      accessKey: "access",
      secretKey: "secret",
      signedDate,
    });

    expect(authorization).toContain("CEA algorithm=HmacSHA256");
    expect(authorization).toContain("access-key=access");
    expect(authorization).toContain("signed-date=240102T030405Z");
    expect(authorization).toMatch(/signature=[0-9a-f]{64}/);
  });
});
