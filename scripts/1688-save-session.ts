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
  const outPath =
    process.env.DISCOVER_1688_STORAGE_STATE?.trim() ||
    path.join("secrets", "1688-storage.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  console.log("브라우저에서 1688에 로그인한 뒤, 이 터미널에서 Enter를 누르세요.");
  console.log(`저장 위치: ${outPath}`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    locale: "zh-CN",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  await page.goto("https://www.1688.com/", { waitUntil: "domcontentloaded" });

  const rl = readline.createInterface({ input, output });
  await rl.question("로그인 완료 후 Enter… ");
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
