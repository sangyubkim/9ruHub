import { toAmazonUsUrl } from "@/lib/amazon/parse-url";
import type { FetchedOption, FetchedProduct } from "@/lib/amazon/types";

type Json = Record<string, unknown>;

function asObj(v: unknown): Json | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Json)
    : null;
}

function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function displayValue(node: unknown): string | null {
  const o = asObj(node);
  if (!o) return null;
  const dv = o.DisplayValue;
  if (typeof dv === "string" && dv.trim()) return dv.trim();
  if (typeof dv === "number" && Number.isFinite(dv)) return String(dv);
  return null;
}

function numberValue(node: unknown): number | null {
  const o = asObj(node);
  if (!o) return null;
  const n = o.DisplayValue ?? o.Amount ?? o.Value;
  if (typeof n === "number" && Number.isFinite(n)) return n;
  if (typeof n === "string") {
    const parsed = Number(n.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function unitLabel(node: unknown): string | null {
  const o = asObj(node);
  const u = o?.Unit;
  return typeof u === "string" ? u.toLowerCase() : null;
}

/** PA-API ItemDimensions Weight → grams */
export function weightGramsFromPaapi(item: Json): number | null {
  const productInfo = asObj(asObj(item.ItemInfo)?.ProductInfo);
  const dims = asObj(productInfo?.ItemDimensions);
  const weight = asObj(dims?.Weight);
  if (!weight) return null;
  const value = numberValue(weight);
  if (value == null || value <= 0) return null;
  const unit = unitLabel(weight) ?? "pounds";
  if (unit.includes("kilogram") || unit === "kg") return Math.round(value * 1000);
  if (unit.includes("gram") || unit === "g") return Math.round(value);
  if (unit.includes("ounce") || unit === "oz") return Math.round(value * 28.3495);
  // pounds / lbs default
  return Math.round(value * 453.592);
}

export function priceFromPaapiItem(item: Json): {
  amount: number;
  currency: string;
} | null {
  const offers = asObj(item.Offers);
  const listings = asArr(offers?.Listings);
  for (const listing of listings) {
    const L = asObj(listing);
    const price = asObj(L?.Price);
    const amount = numberValue(price);
    if (amount != null && amount > 0) {
      const currency =
        (typeof price?.Currency === "string" && price.Currency) || "USD";
      return { amount, currency };
    }
  }
  const summaries = asArr(offers?.Summaries);
  for (const summary of summaries) {
    const S = asObj(summary);
    const lowest = asObj(S?.LowestPrice);
    const amount = numberValue(lowest);
    if (amount != null && amount > 0) {
      const currency =
        (typeof lowest?.Currency === "string" && lowest.Currency) || "USD";
      return { amount, currency };
    }
  }
  return null;
}

export function mapPaapiItemToFetchedProduct(
  item: Json,
  asinHint?: string,
): FetchedProduct | null {
  const asin =
    (typeof item.ASIN === "string" && item.ASIN) || asinHint || "";
  if (!asin) return null;

  const itemInfo = asObj(item.ItemInfo);
  const resolvedTitle = displayValue(asObj(itemInfo?.Title));
  if (!resolvedTitle) return null;

  const byLine = asObj(itemInfo?.ByLineInfo);
  const brand =
    displayValue(asObj(byLine?.Brand)) ||
    displayValue(asObj(byLine?.Manufacturer)) ||
    null;

  const priced = priceFromPaapiItem(item);
  if (!priced) return null;

  const images: string[] = [];
  const primary = asObj(asObj(asObj(item.Images)?.Primary)?.Large);
  if (typeof primary?.URL === "string") images.push(primary.URL);
  for (const variant of asArr(asObj(item.Images)?.Variants)) {
    const large = asObj(asObj(variant)?.Large);
    if (typeof large?.URL === "string") images.push(large.URL);
  }

  const listings = asArr(asObj(item.Offers)?.Listings);
  let inStock = true;
  for (const listing of listings) {
    const avail = asObj(asObj(listing)?.Availability);
    const typ = typeof avail?.Type === "string" ? avail.Type.toLowerCase() : "";
    const msg =
      typeof avail?.Message === "string" ? avail.Message.toLowerCase() : "";
    if (
      typ.includes("unavailable") ||
      msg.includes("unavailable") ||
      msg.includes("out of stock")
    ) {
      inStock = false;
      break;
    }
  }

  const options: FetchedOption[] = [
    { name: "Option", values: ["Default"] },
  ];
  const variations = asObj(item.VariationSummary);
  const dims = asArr(variations?.VariationDimensions);
  // keep simple default options; PA-API variation detail is optional

  const weightGrams = weightGramsFromPaapi(item);
  const sourceUrl =
    (typeof item.DetailPageURL === "string" && item.DetailPageURL) ||
    toAmazonUsUrl(asin);

  return {
    asin,
    sourceUrl,
    title: resolvedTitle,
    brand,
    currency: priced.currency,
    sourcePrice: priced.amount,
    inStock,
    images: [...new Set(images)].slice(0, 10),
    options: dims.length
      ? dims.map((d) => {
          const o = asObj(d);
          const name =
            (typeof o?.DisplayName === "string" && o.DisplayName) || "Option";
          return { name, values: ["Default"] };
        })
      : options,
    weightGrams,
    isFallback: false,
    raw: {
      source: "amazon_paapi",
      asin,
      price: priced.amount,
      currency: priced.currency,
      weightGrams,
      variationDims: dims.length,
    },
  };
}
