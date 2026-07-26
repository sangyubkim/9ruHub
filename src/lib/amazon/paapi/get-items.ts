import {
  getAmazonPaapiConfig,
  type AmazonPaapiConfig,
} from "@/lib/amazon/paapi/config";
import { mapPaapiItemToFetchedProduct } from "@/lib/amazon/paapi/map-item";
import { signPaapiPostRequest } from "@/lib/amazon/paapi/sigv4";
import type { FetchedProduct } from "@/lib/amazon/types";

const GET_ITEMS_PATH = "/paapi5/getitems";
const GET_ITEMS_TARGET =
  "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems";

export const PAAPI_GET_ITEMS_RESOURCES = [
  "ItemInfo.Title",
  "ItemInfo.ByLineInfo",
  "ItemInfo.ProductInfo",
  "Images.Primary.Large",
  "Images.Variants.Large",
  "Offers.Listings.Price",
  "Offers.Listings.Availability",
  "Offers.Summaries.LowestPrice",
] as const;

export async function paapiGetItems(
  asins: string[],
  config?: AmazonPaapiConfig,
): Promise<{
  items: Record<string, unknown>[];
  errors: unknown[];
  raw: unknown;
}> {
  const cfg = config ?? getAmazonPaapiConfig();
  if (!cfg) {
    throw new Error(
      "Amazon PA-API 자격 증명이 없습니다. AMAZON_PAAPI_ACCESS_KEY / SECRET_KEY / PARTNER_TAG 를 설정하세요.",
    );
  }

  const ids = [...new Set(asins.map((a) => a.trim().toUpperCase()).filter(Boolean))].slice(
    0,
    10,
  );
  if (ids.length === 0) {
    throw new Error("ASIN이 필요합니다.");
  }

  const payloadObj = {
    ItemIds: ids,
    ItemIdType: "ASIN",
    PartnerTag: cfg.partnerTag,
    PartnerType: "Associates",
    Marketplace: cfg.marketplace,
    Resources: [...PAAPI_GET_ITEMS_RESOURCES],
  };
  const payload = JSON.stringify(payloadObj);
  const headers = signPaapiPostRequest({
    accessKey: cfg.accessKey,
    secretKey: cfg.secretKey,
    host: cfg.host,
    region: cfg.region,
    path: GET_ITEMS_PATH,
    amzTarget: GET_ITEMS_TARGET,
    payload,
  });

  const res = await fetch(`https://${cfg.host}${GET_ITEMS_PATH}`, {
    method: "POST",
    headers,
    body: payload,
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(
      `PA-API 응답 JSON 파싱 실패 (${res.status}): ${text.slice(0, 200)}`,
    );
  }

  if (!res.ok) {
    const msg =
      json &&
      typeof json === "object" &&
      "Errors" in json &&
      Array.isArray((json as { Errors?: unknown }).Errors)
        ? JSON.stringify((json as { Errors: unknown }).Errors).slice(0, 300)
        : text.slice(0, 300);
    throw new Error(`PA-API HTTP ${res.status}: ${msg}`);
  }

  const root = json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  const result = root.ItemsResult as Record<string, unknown> | undefined;
  const items = Array.isArray(result?.Items)
    ? (result!.Items as Record<string, unknown>[])
    : [];
  const errors = Array.isArray(root.Errors) ? root.Errors : [];

  return { items, errors, raw: json };
}

/** GetItems → FetchedProduct. 실패 시 null (호출측에서 HTML/폴백) */
export async function fetchAmazonUsProductViaPaapi(
  asin: string,
): Promise<FetchedProduct | null> {
  const { items, errors } = await paapiGetItems([asin]);
  const hit =
    items.find(
      (it) =>
        typeof it.ASIN === "string" &&
        it.ASIN.toUpperCase() === asin.toUpperCase(),
    ) ?? items[0];
  if (!hit) {
    if (errors.length) {
      console.warn("[amazon-paapi] GetItems errors", errors);
    }
    return null;
  }
  return mapPaapiItemToFetchedProduct(hit, asin);
}
