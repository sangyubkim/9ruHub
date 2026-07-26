import { describe, expect, it } from "vitest";
import { samplesFromNaverShopItems } from "./naver-competitors";
import type { NaverShopItem } from "./naver-shop-api";

function item(
  partial: Partial<NaverShopItem> & Pick<NaverShopItem, "title" | "link" | "lprice">,
): NaverShopItem {
  return {
    image: "",
    hprice: "",
    mallName: "테스트몰",
    productId: "1",
    productType: "1",
    brand: "",
    maker: "",
    category1: "",
    category2: "",
    category3: "",
    category4: "",
    ...partial,
  };
}

describe("samplesFromNaverShopItems", () => {
  it("builds avg and sample links from shop items", () => {
    const out = samplesFromNaverShopItems(
      [
        item({
          title: "<b>Soundcore</b> P40i",
          link: "https://search.shopping.naver.com/a",
          lprice: "70000",
          mallName: "A몰",
        }),
        item({
          title: "Anker 이어폰",
          link: "https://search.shopping.naver.com/b",
          lprice: "80000",
        }),
      ],
      { maxSamples: 2 },
    );
    expect(out.avg).toBe(75000);
    expect(out.samples).toHaveLength(2);
    expect(out.samples[0]?.title).toBe("Soundcore P40i");
    expect(out.samples[0]?.link).toContain("naver.com");
    expect(out.samples[0]?.matchLabel).toBe("유사");
  });

  it("labels same model when source title provided", () => {
    const out = samplesFromNaverShopItems(
      [
        item({
          title: "사운드코어 P40i 이어폰",
          link: "https://search.shopping.naver.com/a",
          lprice: "70000",
        }),
      ],
      {
        sourceTitle: "Soundcore P40i by Anker",
        sourceBrand: "Anker",
      },
    );
    expect(out.samples[0]?.matchKind).toBe("same_likely");
    expect(out.samples[0]?.matchLabel).toBe("동일 추정");
  });
});
