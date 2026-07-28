import { describe, expect, it } from "vitest";
import {
  filterPriceOutliers,
  isLikelyAccessoryTitle,
  medianPriceKrw,
  samplesFromNaverShopItems,
} from "./naver-competitors";
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

describe("isLikelyAccessoryTitle", () => {
  it("부품·소모품 제목을 걸러낸다", () => {
    expect(isLikelyAccessoryTitle("빙수기 교체용 칼날 부품")).toBe(true);
    expect(isLikelyAccessoryTitle("단미 무선 자동 눈꽃빙수기")).toBe(false);
  });
});

describe("medianPriceKrw / filterPriceOutliers", () => {
  it("중간값을 쓴다", () => {
    expect(medianPriceKrw([1000, 3000, 50000])).toBe(3000);
  });

  it("이상치 가격을 제거한다", () => {
    const kept = filterPriceOutliers([
      12000, 13000, 14000, 15000, 16000, 2000, 90000,
    ]);
    expect(kept).not.toContain(2000);
    expect(kept).not.toContain(90000);
    expect(kept.length).toBeGreaterThanOrEqual(3);
  });
});

describe("samplesFromNaverShopItems", () => {
  it("부품·최저가 잡화를 빼고 본품 중간값에 가깝게 낸다", () => {
    const out = samplesFromNaverShopItems(
      [
        item({
          title: "빙수기 교체용 칼날 부품",
          link: "https://search.shopping.naver.com/part",
          lprice: "2500",
        }),
        item({
          title: "빙수기 실리콘 패킹 소모품",
          link: "https://search.shopping.naver.com/pack",
          lprice: "3000",
        }),
        item({
          title: "홈앤펀 가정용 수동빙수기",
          link: "https://search.shopping.naver.com/a",
          lprice: "13300",
        }),
        item({
          title: "단미 무선 자동 눈꽃빙수기",
          link: "https://search.shopping.naver.com/b",
          lprice: "49800",
        }),
        item({
          title: "가정용 빙수기 팥빙수기계",
          link: "https://search.shopping.naver.com/c",
          lprice: "29900",
        }),
      ],
      { keyword: "빙수기", maxSamples: 5 },
    );
    expect(out.avg).toBe(29900);
    expect(out.prices.every((p) => p >= 10000)).toBe(true);
    expect(out.samples.every((s) => !s.title.includes("부품"))).toBe(true);
  });

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
