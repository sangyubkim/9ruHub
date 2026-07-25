import { describe, expect, it } from "vitest";
import {
  buildReasonUserPayload,
  templateReasonText,
} from "@/lib/recommend/prompts";
import { scoreCandidate } from "@/lib/recommend/score";

describe("recommend prompts", () => {
  it("builds structured JSON payload for GPT", () => {
    const scoreBreakdown = scoreCandidate({
      title: "Mug",
      brand: "Acme",
      sourcePriceUsd: 20,
      salePriceKrw: 45000,
      costKrw: 28000,
      inStock: true,
      imageCount: 2,
      alreadyListed: false,
    });
    const payload = buildReasonUserPayload({
      title: "Mug",
      brand: "Acme",
      sourceUrl: "https://www.amazon.com/dp/B000000000",
      sourcePriceUsd: 20,
      salePriceKrw: 45000,
      costKrw: 28000,
      inStock: true,
      score: scoreBreakdown.total,
      scoreBreakdown,
    });
    expect(payload.task).toBe("recommend_reason");
    expect(payload.scoring.total).toBe(scoreBreakdown.total);
    expect(templateReasonText({
      title: "Mug",
      sourcePriceUsd: 20,
      salePriceKrw: 45000,
      costKrw: 28000,
      inStock: true,
      score: scoreBreakdown.total,
      scoreBreakdown,
    })).toContain("규칙 점수");
  });
});
