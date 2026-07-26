import {
  build1688MobileSearchUrl,
  build1688SearchUrl,
  is1688LoginWallHtml,
  parse1688SearchHtml,
  type Parsed1688SearchHit,
} from "@/lib/discover/supply/search-1688";
import { parse1688MarketOfferJson } from "@/lib/discover/supply/search-1688-api";

export function shouldUse1688Browser(): boolean {
  const mode = (process.env.DISCOVER_1688_BROWSER ?? "auto").toLowerCase();
  if (mode === "off" || mode === "0" || mode === "false") return false;
  if (mode === "on" || mode === "1" || mode === "true" || mode === "force") {
    return true;
  }
  // auto: 기본 사용 (fetch 실패 시 호출부에서만 켬)
  return true;
}

/**
 * Playwright로 1688 검색 페이지를 열어 HTML/JSON에서 오퍼를 추출한다.
 * DISCOVER_1688_STORAGE_STATE 에 로그인 storageState.json 경로를 주면 성공률↑.
 */
export async function fetch1688SearchHtmlViaBrowser(
  keyword: string,
  options?: { limit?: number; timeoutMs?: number },
): Promise<{
  hits: Parsed1688SearchHit[];
  searchUrl: string;
  fetchError?: string;
  via: "playwright";
}> {
  const trimmed = keyword.trim();
  const limit = options?.limit ?? 10;
  const timeoutMs = options?.timeoutMs ?? 45000;
  const searchUrl = build1688SearchUrl(trimmed);
  const mobileUrl = build1688MobileSearchUrl(trimmed);

  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return {
      hits: [],
      searchUrl,
      fetchError: "playwright_not_installed",
      via: "playwright",
    };
  }

  const storageState = process.env.DISCOVER_1688_STORAGE_STATE?.trim();
  const headless = (process.env.DISCOVER_1688_HEADLESS ?? "true") !== "false";

  if (!storageState && process.env.DISCOVER_1688_DEBUG === "1") {
    console.warn(
      "[1688-browser] DISCOVER_1688_STORAGE_STATE 없음 → 로그인벽에 걸릴 가능성 큼. npx tsx scripts/1688-save-session.ts",
    );
  }

  let browser;
  try {
    browser = await chromium.launch({
      headless,
      args: ["--disable-blink-features=AutomationControlled"],
    });
    const context = await browser.newContext({
      locale: "zh-CN",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      ...(storageState ? { storageState } : {}),
    });
    const page = await context.newPage();

    // API 응답을 가로채면 HTML보다 안정적
    let capturedJson: unknown = null;
    page.on("response", async (res) => {
      try {
        const url = res.url();
        if (
          url.includes("marketOfferResultViewService") ||
          url.includes("offer_search")
        ) {
          const ct = res.headers()["content-type"] ?? "";
          if (ct.includes("json") || url.includes("marketOfferResultViewService")) {
            const data = await res.json().catch(() => null);
            if (data) capturedJson = data;
          }
        }
      } catch {
        /* ignore */
      }
    });

    let lastError = "browser_no_offers";
    for (const url of [searchUrl, mobileUrl]) {
      try {
        await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: timeoutMs,
        });
        await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(
          () => undefined,
        );
        await new Promise((r) => setTimeout(r, 1500));

        // 동의/팝업 대략 처리
        await page
          .locator("text=/同意|接受|确定|关闭/")
          .first()
          .click({ timeout: 2000 })
          .catch(() => undefined);

        if (capturedJson) {
          const hits = parse1688MarketOfferJson(capturedJson, limit);
          if (hits.length > 0) {
            return { hits, searchUrl: url, via: "playwright" };
          }
        }

        const fromDom = await page.evaluate((lim) => {
          const out: {
            offerId: string;
            title: string;
            costPriceCny: number | null;
            supplyUrl: string;
          }[] = [];
          const seen = new Set<string>();
          const anchors = Array.from(
            document.querySelectorAll('a[href*="offer/"]'),
          );
          for (const a of anchors) {
            const href = (a as HTMLAnchorElement).href || "";
            const m = href.match(/offer\/(\d{6,})/);
            if (!m || seen.has(m[1]!)) continue;
            seen.add(m[1]!);
            const title = (
              a.getAttribute("title") ||
              a.textContent ||
              ""
            )
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 200);
            // 근처 가격 텍스트
            let costPriceCny: number | null = null;
            const card =
              a.closest("div,li,section") ?? a.parentElement ?? a;
            const priceText = (card.textContent || "").match(
              /¥\s*(\d+(?:\.\d+)?)|￥\s*(\d+(?:\.\d+)?)/,
            );
            if (priceText) {
              const n = Number(priceText[1] ?? priceText[2]);
              if (Number.isFinite(n) && n > 0) costPriceCny = n;
            }
            out.push({
              offerId: m[1]!,
              title: title || `1688 offer ${m[1]}`,
              costPriceCny,
              supplyUrl: `https://detail.1688.com/offer/${m[1]}.html`,
            });
            if (out.length >= lim) break;
          }
          return out;
        }, limit);

        if (fromDom.length > 0) {
          return { hits: fromDom, searchUrl: url, via: "playwright" };
        }

        const html = await page.content();
        const pageUrl = page.url();
        if (
          is1688LoginWallHtml(html) ||
          /login\.(1688|taobao)\.com/i.test(pageUrl)
        ) {
          lastError = storageState
            ? "login_session_expired"
            : "needs_login_session";
          if (process.env.DISCOVER_1688_DEBUG === "1") {
            console.warn(
              `[1688-browser] login wall url=${pageUrl} htmlLen=${html.length}`,
            );
          }
          continue;
        }

        const hits = parse1688SearchHtml(html, limit);
        if (hits.length > 0) {
          return { hits, searchUrl: url, via: "playwright" };
        }
        lastError = "no_offers_parsed";
        if (process.env.DISCOVER_1688_DEBUG === "1") {
          console.warn(
            `[1688-browser] no hits url=${url} htmlLen=${html.length}`,
          );
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    return {
      hits: [],
      searchUrl,
      fetchError: lastError,
      via: "playwright",
    };
  } catch (err) {
    return {
      hits: [],
      searchUrl,
      fetchError: err instanceof Error ? err.message : String(err),
      via: "playwright",
    };
  } finally {
    await browser?.close().catch(() => undefined);
  }
}
