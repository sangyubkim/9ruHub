import { describe, expect, it, vi, afterEach } from "vitest";
import { generateAiDetail } from "@/lib/ai-detail/generate";
import { parseAiDetailResponse } from "@/lib/ai-detail/parse";
import { localizeOptions } from "@/lib/ai-detail/options";
import { templateAiDetail } from "@/lib/ai-detail/prompts";

const sampleInput = {
  title: "Acme Stainless Steel Bottle 20oz",
  brand: "Acme",
  sourceUrl: "https://www.amazon.com/dp/B0TEST0001",
  asin: "B0TEST0001",
  sourcePriceUsd: 24.99,
  salePriceKrw: 52000,
  inStock: true,
  images: ["https://example.com/a.jpg"],
  options: [
    { name: "Color", values: ["Black", "White"] },
    { name: "Size", values: ["One Size"] },
  ],
  categoryHint: "해외구매대행",
  sourceLang: "en",
};

describe("ai-detail parser / fallback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OPENAI_API_KEY;
  });

  it("localizes option names and values", () => {
    const opts = localizeOptions(sampleInput.options);
    expect(opts[0]?.name).toBe("색상");
    expect(opts[0]?.values).toContain("블랙");
    expect(opts[1]?.name).toBe("사이즈");
    expect(opts[1]?.values).toContain("프리사이즈");
  });

  it("builds high-quality Korean template without GPT", () => {
    const content = templateAiDetail(sampleInput);
    expect(content.usedGpt).toBe(false);
    expect(content.titleKo).toContain("[구매대행]");
    expect(content.keywords.length).toBeGreaterThan(2);
    expect(content.detailHtml).toContain("구매대행");
    expect(content.detailHtml).toContain("FAQ");
    expect(content.detailHtml).not.toContain("<script");
    expect(content.translationNote).toContain("en");
    expect(content.options[0]?.name).toBe("색상");
  });

  it("parses GPT JSON and falls back missing fields", () => {
    const parsed = parseAiDetailResponse(
      {
        titleKo: "테스트 물병",
        keywords: ["물병", "직구"],
        detailHtml: "<section><h2>ok</h2><script>x</script></section>",
        options: [{ name: "Color", values: ["Red"] }],
        noticeText: "고지",
        translationNote: "번역 메모",
        sourceLang: "en",
      },
      sampleInput,
      true,
    );
    expect(parsed.usedGpt).toBe(true);
    expect(parsed.titleKo).toBe("테스트 물병");
    expect(parsed.keywords).toEqual(["물병", "직구"]);
    expect(parsed.detailHtml).toContain("<h2>");
    expect(parsed.detailHtml).not.toMatch(/script/i);
    expect(parsed.options[0]?.name).toBe("색상");
    expect(parsed.options[0]?.values).toContain("레드");
  });

  it("falls back when GPT JSON is null", () => {
    const parsed = parseAiDetailResponse(null, sampleInput, false);
    expect(parsed.usedGpt).toBe(false);
    expect(parsed.titleKo).toContain("Acme");
  });

  it("generateAiDetail uses template when API key missing", async () => {
    delete process.env.OPENAI_API_KEY;
    const content = await generateAiDetail(sampleInput);
    expect(content.usedGpt).toBe(false);
    expect(content.detailHtml).toContain("FAQ");
  });

  it("generateAiDetail uses mocked GPT response", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  titleKo: "GPT 제목",
                  keywords: ["키워드A"],
                  detailHtml: "<section><h2>GPT</h2><p>본문</p></section>",
                  options: [{ name: "Size", values: ["Large"] }],
                  noticeText: "고지GPT",
                  translationNote: "영→한",
                  sourceLang: "en",
                }),
              },
            },
          ],
        }),
      }),
    );

    const content = await generateAiDetail(sampleInput);
    expect(content.usedGpt).toBe(true);
    expect(content.titleKo).toBe("GPT 제목");
    expect(content.keywords).toEqual(["키워드A"]);
    expect(content.options[0]?.name).toBe("사이즈");
  });
});
