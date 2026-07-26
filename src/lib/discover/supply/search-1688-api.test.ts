import { describe, expect, it } from "vitest";
import { parse1688MarketOfferJson } from "./search-1688-api";

describe("parse1688MarketOfferJson", () => {
  it("maps offerList fields to hits", () => {
    const hits = parse1688MarketOfferJson(
      {
        data: {
          offerList: [
            {
              offerId: "1234567890123",
              information: { subject: "无线风扇批发" },
              tradePrice: {
                offerPrice: { valueString: "23.5" },
              },
            },
            {
              information: {
                offerId: "9876543210987",
                subject: "迷你风扇",
              },
              tradePrice: {
                offerPrice: { price: 18 },
              },
            },
          ],
        },
      },
      5,
    );
    expect(hits).toHaveLength(2);
    expect(hits[0]?.offerId).toBe("1234567890123");
    expect(hits[0]?.title).toContain("风扇");
    expect(hits[0]?.costPriceCny).toBe(23.5);
    expect(hits[1]?.costPriceCny).toBe(18);
  });
});
