/**
 * 9ruTrip apps/api/.env 의 GEMINI_* 를 9ruHub .env 에 반영
 * (키 전문은 로그에 출력하지 않음)
 */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

const tripEnv = path.resolve(process.cwd(), "../9ruTrip/apps/api/.env");
const hubEnv = path.resolve(process.cwd(), ".env");

function setEnvKey(content: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(content)) return content.replace(re, line);
  return `${content.replace(/\s*$/, "")}\n${line}\n`;
}

function main() {
  if (!fs.existsSync(tripEnv)) {
    throw new Error(`9ruTrip env not found: ${tripEnv}`);
  }
  if (!fs.existsSync(hubEnv)) {
    throw new Error(`.env not found: ${hubEnv}`);
  }

  const parsed = dotenv.parse(fs.readFileSync(tripEnv));
  const apiKey = (parsed.GEMINI_API_KEY || "").trim();
  const model =
    (parsed.GEMINI_MODEL || "").trim() || "gemini-flash-lite-latest";
  if (!apiKey) throw new Error("GEMINI_API_KEY empty in 9ruTrip");

  let content = fs.readFileSync(hubEnv, "utf8");
  content = setEnvKey(content, "GEMINI_API_KEY", apiKey);
  content = setEnvKey(content, "GEMINI_MODEL", model);
  content = setEnvKey(content, "AI_PROVIDER", "gemini");
  fs.writeFileSync(hubEnv, content.endsWith("\n") ? content : `${content}\n`);

  console.log(
    JSON.stringify({
      ok: true,
      model,
      keyLen: apiKey.length,
      keyPrefix: `${apiKey.slice(0, 6)}…`,
    }),
  );
}

main();
