/**
 * 1688 로그인 세션을 storageState로 저장한다.
 * 브라우저가 열리면 직접 로그인한 뒤 터미널에서 Enter.
 *
 *   npx tsx scripts/1688-save-session.ts
 *   → secrets/1688-storage.json
 *
 * .env:
 *   DISCOVER_1688_STORAGE_STATE=./secrets/1688-storage.json
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { chromium } from "playwright";

async function main() {
  if (process.env.DISCOVER_1688_ALLOW_SESSION !== "true") {
    console.error(
      "1688 자동 세션 저장은 기본 차단되어 있습니다 (계정 제재 위험).",
    );
    console.error(
      "정말 필요할 때만 .env 에 DISCOVER_1688_ALLOW_SESSION=true 후 다시 실행하세요.",
    );
    console.error(
      "권장: 일반 Chrome에서 직접 로그인 → 상품 URL을 앱에 붙이기.",
    );
    process.exit(1);
  }

  const outPath =
    process.env.DISCOVER_1688_STORAGE_STATE?.trim() ||
    path.join("secrets", "1688-storage.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  console.log("브라우저에서 1688에 로그인한 뒤, 이 터미널에서 Enter를 누르세요.");
  console.log("슬라이더 인증(拖动滑块)이 나오면 직접 통과한 뒤 로그인하세요.");
  console.log(`저장 위치: ${outPath}`);

  // 번들 Chromium은 캡차에 자주 걸림 → 설치된 Chrome 우선
  let browser;
  try {
    browser = await chromium.launch({
      headless: false,
      channel: "chrome",
      args: ["--disable-blink-features=AutomationControlled"],
    });
    console.log("launch: system Chrome");
  } catch {
    browser = await chromium.launch({
      headless: false,
      args: ["--disable-blink-features=AutomationControlled"],
    });
    console.log("launch: Playwright Chromium (Chrome 미설치 시)");
  }
  const context = await browser.newContext({
    locale: "zh-CN",
    viewport: { width: 1280, height: 800 },
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });
  const page = await context.newPage();
  await page.goto("https://login.1688.com/", { waitUntil: "domcontentloaded" });

  const rl = readline.createInterface({ input, output });
  await rl.question(
    "캡차 통과 + 로그인 후, 검색 결과가 보이는 상태에서 Enter… ",
  );
  rl.close();

  // 검색이 되는지 스모크
  await page.goto(
    "https://s.1688.com/selloffer/offer_search.htm?keywords=" +
      encodeURIComponent("风扇"),
    { waitUntil: "domcontentloaded", timeout: 60000 },
  );
  await new Promise((r) => setTimeout(r, 3000));
  const html = await page.content();
  const ok =
    /offer\/\d{6,}/.test(html) ||
    /offerId/i.test(html) ||
    (await page.locator('a[href*="offer/"]').count()) > 0;

  await context.storageState({ path: outPath });
  await browser.close();

  if (!ok) {
    console.warn(
      "경고: 검색 페이지에서 오퍼를 확인하지 못했습니다. 로그인·캡차를 다시 확인하세요.",
    );
    console.warn(`세션 파일은 저장됨: ${outPath}`);
    process.exitCode = 2;
    return;
  }

  console.log(`세션 저장 완료: ${outPath}`);
  console.log(".env 에 다음을 넣으세요:");
  console.log(`DISCOVER_1688_STORAGE_STATE=${outPath.replace(/\\/g, "/")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
