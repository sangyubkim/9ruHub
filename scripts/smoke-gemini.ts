import "dotenv/config";
import { geminiChatText, getGeminiConfig } from "../src/lib/ai/gemini";

async function main() {
  const cfg = getGeminiConfig();
  console.log(
    JSON.stringify({
      enabled: cfg.enabled,
      model: cfg.model,
      keyLen: cfg.apiKey.length,
    }),
  );
  if (!cfg.enabled) {
    console.error("GEMINI_API_KEY missing");
    process.exit(1);
  }
  const text = await geminiChatText(
    "한 문장으로만 답하세요.",
    { ping: true, ask: "구매대행 OS 준비됐는지 짧게 확인" },
    0.1,
  );
  console.log(JSON.stringify({ ok: Boolean(text), preview: text?.slice(0, 200) }));
  if (!text) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
