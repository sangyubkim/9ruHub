import { describe, expect, it } from "vitest";
import {
  classifyAmazonShippingMessage,
  eligibilityFromOverride,
  extractShippingMessageFromHtml,
  readShipOverrideFromEnv,
} from "@/lib/amazon/ship-eligibility";
import {
  buildSourcingFit,
  isDomesticCompetitionLow,
} from "@/lib/recommend/sourcing-fit";

describe("classifyAmazonShippingMessage", () => {
  it("직배송 불가 문구 → fail", () => {
    expect(
      classifyAmazonShippingMessage(
        "This item cannot be shipped to your selected delivery location.",
      ),
    ).toBe("fail");
    expect(
      classifyAmazonShippingMessage(
        "Sorry, this item does not ship to Korea, Republic of.",
      ),
    ).toBe("fail");
  });

  it("재고·배송 가능 문구 → ok", () => {
    expect(
      classifyAmazonShippingMessage("In Stock. Free delivery Thursday."),
    ).toBe("ok");
    expect(classifyAmazonShippingMessage("Get it by Monday, Ships from Amazon")).toBe(
      "ok",
    );
  });

  it("애매·빈 값 → unclear", () => {
    expect(classifyAmazonShippingMessage("")).toBe("unclear");
    expect(classifyAmazonShippingMessage("See options")).toBe("unclear");
  });
});

describe("extractShippingMessageFromHtml", () => {
  it("availability·delivery 블록을 읽는다", () => {
    const html = `
      <html><body>
        <div id="availability">In Stock.</div>
        <div id="deliveryBlockMessage">This item cannot be shipped to your selected delivery location.</div>
      </body></html>`;
    const msg = extractShippingMessageFromHtml(html);
    expect(msg).toMatch(/cannot be shipped/i);
    expect(classifyAmazonShippingMessage(msg)).toBe("fail");
  });
});

describe("env override", () => {
  it("eligibilityFromOverride로 krDirectShip=false", () => {
    const e = eligibilityFromOverride("B0TEST", { us: "ok", kr: "fail" });
    expect(e.usForwarderOk).toBe(true);
    expect(e.krDirectShip).toBe(false);
    expect(e.source).toBe("env_override");
    expect(e.confidence).toBe("high");
  });

  it("readShipOverrideFromEnv는 JSON 맵을 읽는다", () => {
    const prev = process.env.AMAZON_SHIP_OVERRIDES;
    process.env.AMAZON_SHIP_OVERRIDES = JSON.stringify({
      B0ABC: { us: "ok", kr: "fail" },
    });
    expect(readShipOverrideFromEnv("B0ABC")).toEqual({ us: "ok", kr: "fail" });
    if (prev === undefined) delete process.env.AMAZON_SHIP_OVERRIDES;
    else process.env.AMAZON_SHIP_OVERRIDES = prev;
  });
});

describe("buildSourcingFit", () => {
  const shipProxy = eligibilityFromOverride("B0X", { us: "ok", kr: "fail" });
  const shipDirect = eligibilityFromOverride("B0Y", { us: "ok", kr: "ok" });
  const shipUsFail = eligibilityFromOverride("B0Z", { us: "fail", kr: "fail" });

  it("국내 경쟁 적음 판별", () => {
    expect(isDomesticCompetitionLow({ marketType: "SCARCE" })).toBe(true);
    expect(isDomesticCompetitionLow({ shopTotal: 50 })).toBe(true);
    expect(isDomesticCompetitionLow({ marketType: "PRICE_WAR" })).toBe(false);
  });

  it("US ok + KR fail + 국내 적음 → PROXY_BUY_STRONG", () => {
    const fit = buildSourcingFit({
      ship: shipProxy,
      marketType: "SCARCE",
      scarcityScore: 80,
    });
    expect(fit.code).toBe("PROXY_BUY_STRONG");
    expect(fit.recommendBoost).toBe(1);
    expect(fit.score).toBeGreaterThanOrEqual(90);
  });

  it("US ok + KR fail + 국내 많음 → PROXY_BUY", () => {
    const fit = buildSourcingFit({
      ship: shipProxy,
      marketType: "PRICE_WAR",
      shopTotal: 5000,
    });
    expect(fit.code).toBe("PROXY_BUY");
    expect(fit.recommendBoost).toBe(0);
  });

  it("KR 직배송 가능 → DIRECT_SHIP_RISK", () => {
    const fit = buildSourcingFit({ ship: shipDirect, marketType: "SCARCE" });
    expect(fit.code).toBe("DIRECT_SHIP_RISK");
    expect(fit.recommendBoost).toBe(-1);
  });

  it("US fail → US_FAIL", () => {
    const fit = buildSourcingFit({ ship: shipUsFail });
    expect(fit.code).toBe("US_FAIL");
    expect(fit.recommendBoost).toBe(-1);
  });

  it("미확인은 하드 제외하지 않음", () => {
    const fit = buildSourcingFit({ ship: null, marketType: "SCARCE" });
    expect(fit.code).toBe("UNCLEAR");
    expect(fit.recommendBoost).toBe(0);
  });
});
