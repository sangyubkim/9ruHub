import { describe, expect, it } from "vitest";
import {
  mapPaapiItemToFetchedProduct,
  priceFromPaapiItem,
  weightGramsFromPaapi,
} from "./map-item";

const sampleItem = {
  ASIN: "B0CQXG17RL",
  DetailPageURL: "https://www.amazon.com/dp/B0CQXG17RL",
  ItemInfo: {
    Title: { DisplayValue: "Soundcore P40i by Anker", Label: "Title" },
    ByLineInfo: {
      Brand: { DisplayValue: "Anker", Label: "Brand" },
    },
    ProductInfo: {
      ItemDimensions: {
        Weight: { DisplayValue: 0.3, Unit: "pounds", Label: "Weight" },
      },
    },
  },
  Images: {
    Primary: {
      Large: { URL: "https://m.media-amazon.com/images/I/example.jpg" },
    },
  },
  Offers: {
    Listings: [
      {
        Price: { Amount: 41.98, Currency: "USD", DisplayAmount: "$41.98" },
        Availability: { Type: "Now", Message: "In Stock" },
      },
    ],
  },
};

describe("mapPaapiItemToFetchedProduct", () => {
  it("maps title price brand images weight", () => {
    const p = mapPaapiItemToFetchedProduct(sampleItem);
    expect(p).not.toBeNull();
    expect(p!.asin).toBe("B0CQXG17RL");
    expect(p!.title).toContain("Soundcore");
    expect(p!.brand).toBe("Anker");
    expect(p!.sourcePrice).toBe(41.98);
    expect(p!.isFallback).toBe(false);
    expect(p!.images[0]).toContain("media-amazon");
    expect(p!.weightGrams).toBe(Math.round(0.3 * 453.592));
    expect(p!.raw?.source).toBe("amazon_paapi");
  });

  it("returns null without price", () => {
    const noPrice = {
      ...sampleItem,
      Offers: { Listings: [] },
    };
    expect(mapPaapiItemToFetchedProduct(noPrice)).toBeNull();
  });
});

describe("priceFromPaapiItem / weightGramsFromPaapi", () => {
  it("reads listing price", () => {
    expect(priceFromPaapiItem(sampleItem)?.amount).toBe(41.98);
  });

  it("converts pounds to grams", () => {
    expect(weightGramsFromPaapi(sampleItem)).toBe(Math.round(0.3 * 453.592));
  });
});
