/**
 * Amazon.com → US 포워더 / 한국 직배송 가능 여부 (best-effort).
 * HTML·세션 기반이라 실패 시 UNCLEAR — 하드 제외하지 않음.
 */

import * as cheerio from "cheerio";
import { toAmazonUsUrl } from "@/lib/amazon/parse-url";

export type ShipCountry = "US" | "KR";
export type ShipEligibilityStatus = "ok" | "fail" | "unclear";
export type ShipConfidence = "low" | "medium" | "high";

export type CountryShipResult = {
  country: ShipCountry;
  status: ShipEligibilityStatus;
  confidence: ShipConfidence;
  evidence: string | null;
};

export type AmazonShipEligibility = {
  us: CountryShipResult;
  kr: CountryShipResult;
  /** false = 한국 직배송 불가 → 구매대행 유리. null = 미확인 */
  krDirectShip: boolean | null;
  /** true = US 포워더로 수령 가능. null = 미확인 */
  usForwarderOk: boolean | null;
  confidence: ShipConfidence;
  source: "html" | "env_override" | "unavailable";
  checkedAt: string;
  note: string | null;
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const FAIL_RE =
  /cannot be shipped to|can't be shipped to|does not ship to|not available for delivery|we['’]re unable to ship|unable to ship this item|shipping restrictions apply|this item is not available in your|현재 위치로는 배송할 수 없|배송할 수 없습니다|배송 불가/i;

const OK_RE =
  /in stock|ships from|delivered by|free delivery|get it by|arrives|delivery\s+\w+|배송\s*가능|배송됩니다|내일\s*도착|오늘\s*도착/i;

const BLOCK_RE =
  /api-services-support@amazon\.com|Enter the characters you see below|Robot Check|sorry, we just need to make sure you're not a robot/i;

/** 배송 문구만으로 ok/fail/unclear 분류 (순수) */
export function classifyAmazonShippingMessage(
  text: string | null | undefined,
): ShipEligibilityStatus {
  if (!text?.trim()) return "unclear";
  const t = text.replace(/\s+/g, " ").trim();
  if (FAIL_RE.test(t)) return "fail";
  if (OK_RE.test(t)) return "ok";
  return "unclear";
}

/** 상품 페이지에서 배송·재고 관련 텍스트 블록 추출 */
export function extractShippingMessageFromHtml(html: string): string {
  const $ = cheerio.load(html);
  const chunks: string[] = [];
  const selectors = [
    "#deliveryBlockMessage",
    "#ddmDeliveryMessage",
    "#mir-layout-DELIVERY_BLOCK",
    "#deliveryMessageMirId",
    "#availability",
    "#outOfStock",
    "#contextualIngressPt",
    "#glow-ingress-block",
    "[data-csa-c-delivery-price]",
    "#fast-track-message",
    "#qualifiedBuybox",
  ];
  for (const sel of selectors) {
    const t = $(sel).text().replace(/\s+/g, " ").trim();
    if (t && t.length > 2) chunks.push(t.slice(0, 400));
  }
  if (chunks.length === 0) {
    const bodyHit = html.match(
      /(?:cannot be shipped to|can't be shipped to|does not ship to|in stock|get it by)[^<]{0,120}/i,
    );
    if (bodyHit?.[0]) chunks.push(bodyHit[0].replace(/\s+/g, " ").trim());
  }
  return [...new Set(chunks)].join(" | ").slice(0, 800);
}

function looksBlocked(html: string): boolean {
  return BLOCK_RE.test(html) || html.length < 8000;
}

function minConfidence(a: ShipConfidence, b: ShipConfidence): ShipConfidence {
  const order: ShipConfidence[] = ["low", "medium", "high"];
  return order[Math.min(order.indexOf(a), order.indexOf(b))]!;
}

function statusToBool(s: ShipEligibilityStatus): boolean | null {
  if (s === "ok") return true;
  if (s === "fail") return false;
  return null;
}

function deriveConfidence(
  us: CountryShipResult,
  kr: CountryShipResult,
  source: AmazonShipEligibility["source"],
): ShipConfidence {
  if (source === "env_override") return "high";
  if (us.status === "unclear" && kr.status === "unclear") return "low";
  return minConfidence(us.confidence, kr.confidence);
}

function buildEligibility(
  us: CountryShipResult,
  kr: CountryShipResult,
  source: AmazonShipEligibility["source"],
  note: string | null,
): AmazonShipEligibility {
  return {
    us,
    kr,
    krDirectShip: statusToBool(kr.status),
    usForwarderOk: statusToBool(us.status),
    confidence: deriveConfidence(us, kr, source),
    source,
    checkedAt: new Date().toISOString(),
    note,
  };
}

export function unclearShipEligibility(note: string): AmazonShipEligibility {
  const unclear = (country: ShipCountry): CountryShipResult => ({
    country,
    status: "unclear",
    confidence: "low",
    evidence: null,
  });
  return buildEligibility(unclear("US"), unclear("KR"), "unavailable", note);
}

type OverridePair = { us?: ShipEligibilityStatus; kr?: ShipEligibilityStatus };

/** AMAZON_SHIP_OVERRIDES={"B0XXX":{"us":"ok","kr":"fail"}} */
export function readShipOverrideFromEnv(
  asin: string,
): OverridePair | null {
  const raw = process.env.AMAZON_SHIP_OVERRIDES?.trim();
  if (!raw) return null;
  try {
    const map = JSON.parse(raw) as Record<string, OverridePair>;
    const hit = map[asin.toUpperCase()] ?? map[asin];
    if (!hit || typeof hit !== "object") return null;
    return hit;
  } catch {
    return null;
  }
}

export function eligibilityFromOverride(
  asin: string,
  override: OverridePair,
): AmazonShipEligibility {
  const usStatus = override.us ?? "unclear";
  const krStatus = override.kr ?? "unclear";
  return buildEligibility(
    {
      country: "US",
      status: usStatus,
      confidence: "high",
      evidence: `env override ${asin}`,
    },
    {
      country: "KR",
      status: krStatus,
      confidence: "high",
      evidence: `env override ${asin}`,
    },
    "env_override",
    "AMAZON_SHIP_OVERRIDES 수동 값",
  );
}

function cookieHeader(res: Response, prev = ""): string {
  const jar = new Map<string, string>();
  for (const part of prev.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k && rest.length) jar.set(k, rest.join("="));
  }
  const anyHeaders = res.headers as Headers & {
    getSetCookie?: () => string[];
  };
  const setCookies =
    typeof anyHeaders.getSetCookie === "function"
      ? anyHeaders.getSetCookie()
      : [];
  for (const c of setCookies) {
    const [pair] = c.split(";");
    const [k, ...rest] = (pair ?? "").split("=");
    if (k && rest.length) jar.set(k.trim(), rest.join("="));
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function fetchAmazonHtml(
  url: string,
  cookie = "",
  timeoutMs = 10000,
): Promise<{ html: string; cookie: string; ok: boolean }> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Accept-Language": "en-US,en;q=0.9",
      Accept: "text/html,application/xhtml+xml",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
    redirect: "follow",
  });
  const html = await res.text();
  return {
    html,
    cookie: cookieHeader(res, cookie),
    ok: res.ok && !looksBlocked(html),
  };
}

/** glow address-change로 배송국 전환 시도 (세션 쿠키 필요) */
async function trySetDeliveryCountry(
  cookie: string,
  countryCode: "US" | "KR",
  timeoutMs = 8000,
): Promise<string> {
  const url =
    "https://www.amazon.com/portal-migration/hz/glow/address-change?actionSource=glow";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "User-Agent": UA,
        "Content-Type": "application/json",
        Accept: "application/json",
        Cookie: cookie,
        Origin: "https://www.amazon.com",
        Referer: "https://www.amazon.com/",
      },
      body: JSON.stringify({
        locationType: "COUNTRY",
        district: countryCode,
        countryCode,
        storeContext: "generic",
        deviceType: "web",
        pageType: "Detail",
        actionSource: "glow",
      }),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    return cookieHeader(res, cookie);
  } catch {
    return cookie;
  }
}

function resultFromHtml(
  country: ShipCountry,
  html: string,
  fetchOk: boolean,
): CountryShipResult {
  if (!fetchOk) {
    return {
      country,
      status: "unclear",
      confidence: "low",
      evidence: "fetch blocked or empty",
    };
  }
  const evidence = extractShippingMessageFromHtml(html);
  const status = classifyAmazonShippingMessage(evidence);
  const confidence: ShipConfidence =
    status === "unclear" ? "low" : evidence.length > 40 ? "medium" : "low";
  return { country, status, confidence, evidence: evidence || null };
}

/**
 * 단일 국가 배송 가능 여부 조회.
 * env override → HTML(세션+glow) 순.
 */
export async function checkAmazonShipToCountry(
  asin: string,
  country: ShipCountry,
): Promise<CountryShipResult> {
  const id = asin.trim().toUpperCase();
  if (!id) {
    return {
      country,
      status: "unclear",
      confidence: "low",
      evidence: "missing asin",
    };
  }

  if (process.env.AMAZON_SHIP_CHECK === "0") {
    return {
      country,
      status: "unclear",
      confidence: "low",
      evidence: "AMAZON_SHIP_CHECK=0",
    };
  }

  const override = readShipOverrideFromEnv(id);
  if (override) {
    const status =
      (country === "US" ? override.us : override.kr) ?? "unclear";
    return {
      country,
      status,
      confidence: "high",
      evidence: `env override`,
    };
  }

  const sourceUrl = toAmazonUsUrl(id);
  try {
    const first = await fetchAmazonHtml(sourceUrl);
    let cookie = first.cookie;
    if (country !== "US") {
      cookie = await trySetDeliveryCountry(cookie, country);
      const second = await fetchAmazonHtml(sourceUrl, cookie);
      return resultFromHtml(country, second.html, second.ok);
    }
    return resultFromHtml(country, first.html, first.ok);
  } catch (err) {
    return {
      country,
      status: "unclear",
      confidence: "low",
      evidence: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * US + KR 배송 시그널 한 번에 수집.
 * US 페이지 1회 + (가능하면) KR 주소 전환 후 재조회.
 */
export async function checkAmazonShipEligibility(
  asin: string,
): Promise<AmazonShipEligibility> {
  const id = asin.trim().toUpperCase();
  if (!id) return unclearShipEligibility("ASIN 없음");

  if (process.env.AMAZON_SHIP_CHECK === "0") {
    return unclearShipEligibility("AMAZON_SHIP_CHECK=0 (스킵)");
  }

  const override = readShipOverrideFromEnv(id);
  if (override) return eligibilityFromOverride(id, override);

  const sourceUrl = toAmazonUsUrl(id);
  try {
    const first = await fetchAmazonHtml(sourceUrl);
    const us = resultFromHtml("US", first.html, first.ok);

    let kr: CountryShipResult;
    if (!first.ok) {
      kr = {
        country: "KR",
        status: "unclear",
        confidence: "low",
        evidence: "US page fetch failed; KR check skipped",
      };
    } else {
      const cookie = await trySetDeliveryCountry(first.cookie, "KR");
      const second = await fetchAmazonHtml(sourceUrl, cookie);
      kr = resultFromHtml("KR", second.html, second.ok);
      // glow 전환이 안 먹혀 US와 동일 메시지면 KR은 unclear로 완화
      if (
        kr.status !== "unclear" &&
        us.evidence &&
        kr.evidence &&
        us.evidence === kr.evidence &&
        kr.status === us.status
      ) {
        kr = {
          country: "KR",
          status: "unclear",
          confidence: "low",
          evidence: "delivery destination may not have switched",
        };
      }
    }

    const noteParts: string[] = [];
    if (us.status === "unclear" || kr.status === "unclear") {
      noteParts.push("일부 국가 판정 불명확(로봇 차단·주소 전환 실패 가능)");
    }
    if (us.status === "ok" && kr.status === "fail") {
      noteParts.push("US 수령 가능·KR 직배송 불가 → 구매대행 후보");
    } else if (kr.status === "ok") {
      noteParts.push("한국 직배송 가능 → 직배송 경쟁 주의");
    } else if (us.status === "fail") {
      noteParts.push("US 포워더 수령도 어려울 수 있음");
    }

    return buildEligibility(
      us,
      kr,
      "html",
      noteParts.length ? noteParts.join(" · ") : null,
    );
  } catch (err) {
    return unclearShipEligibility(
      err instanceof Error ? err.message : String(err),
    );
  }
}
