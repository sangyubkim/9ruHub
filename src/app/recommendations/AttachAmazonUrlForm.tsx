"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { parseWeightTokenToGrams } from "@/lib/product/parse-weight";

type WeightUnit = "oz" | "g" | "lb";

export function AttachAmazonUrlForm({
  recommendationId,
  keywordHint,
  initialUrl,
  mode = "attach",
}: {
  recommendationId: string;
  keywordHint?: string | null;
  initialUrl?: string | null;
  /** attach: 수요 카드에 URL 최초 부착 / fix: 폴백 카드 원가·URL 수정 */
  mode?: "attach" | "fix";
}) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl ?? "");
  const [cost, setCost] = useState("");
  const [weight, setWeight] = useState("");
  // Amazon 페이지는 ounces가 많음 → 기본 oz
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("oz");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  // fix 모드는 처음부터 수동 입력 펼침, attach는 + 로 펼침
  const [manualOpen, setManualOpen] = useState(mode === "fix");

  const isFix = mode === "fix";

  const weightGramsPreview = useMemo(() => {
    if (!weight.trim()) return null;
    const n = Number(weight);
    if (!Number.isFinite(n) || n <= 0) return null;
    return parseWeightTokenToGrams(n, weightUnit);
  }, [weight, weightUnit]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      if (isFix && !cost.trim()) {
        throw new Error("브라우저에 보이는 실가(USD)를 입력하세요.");
      }
      let weightGrams: number | undefined;
      if (weight.trim()) {
        const n = Number(weight);
        const grams = parseWeightTokenToGrams(n, weightUnit);
        if (grams == null) {
          throw new Error("무게를 숫자로 입력하고 단위(oz/g/lb)를 선택하세요.");
        }
        weightGrams = grams;
      }
      const res = await fetch(
        `/api/recommendations/${recommendationId}/amazon-url`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: url.trim() || undefined,
            costUsd: cost.trim() ? cost.trim() : undefined,
            weightGrams,
          }),
        },
      );
      const data = (await res.json()) as {
        error?: string;
        sourcePriceUsd?: number;
        weightGrams?: number | null;
        salePriceKrw?: number;
        score?: number;
        label?: string;
        isFallback?: boolean;
        marketVerdict?: string | null;
        asin?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "적용 실패");
      const weightLabel =
        data.weightGrams != null
          ? ` · ${data.weightGrams.toLocaleString("ko-KR")}g`
          : "";
      setOkMsg(
        `ASIN ${data.asin} · $${data.sourcePriceUsd}${weightLabel} → ${data.salePriceKrw?.toLocaleString("ko-KR")}원 · ${data.label} ${data.score?.toFixed(1)}점${data.marketVerdict ? ` · ${data.marketVerdict}` : ""}${data.isFallback ? " (FALLBACK·수동원가 권장)" : ""}`,
      );
      if (!isFix) setUrl("");
      setCost("");
      setWeight("");
      setWeightUnit("oz");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  const searchHint = isFix
    ? "삭제하지 말고, Chrome에서 본 실가(USD)·무게(g)를 넣어 카드를 갱신하세요. URL이 틀렸으면 함께 수정할 수 있습니다."
    : keywordHint?.trim()
      ? `Amazon.com에서 「${keywordHint.trim()}」 검색 후 URL을 붙이세요.`
      : "Amazon.com 상품 URL 또는 ASIN을 붙이세요.";

  return (
    <form
      onSubmit={onSubmit}
      className={`mt-3 space-y-2 rounded-xl border border-dashed p-3 ${
        isFix
          ? "border-amber-300 bg-amber-50/80"
          : "border-sky-300 bg-sky-50/70"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p
          className={`text-sm font-medium ${
            isFix ? "text-amber-950" : "text-sky-950"
          }`}
        >
          {isFix ? "원가·무게 수정 · 다시 적용" : "Amazon URL 붙이기"}
        </p>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            isFix
              ? "bg-red-100 text-red-800"
              : "bg-amber-100 text-amber-900"
          }`}
        >
          {isFix ? "가격 미확인 → 수동 입력" : "Amazon URL 필요"}
        </span>
      </div>
      <p
        className={`text-sm ${
          isFix ? "text-amber-950/70" : "text-sky-950/70"
        }`}
      >
        {searchHint}
      </p>
      <input
        type="text"
        required={!isFix}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://www.amazon.com/dp/... 또는 ASIN"
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base"
      />

      {!manualOpen ? (
        <button
          type="button"
          onClick={() => setManualOpen(true)}
          className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          <span aria-hidden>+</span> 수동 입력 (원가·무게)
        </button>
      ) : (
        <div className="space-y-2 rounded-lg border border-zinc-200 bg-white/90 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-zinc-800">수동 입력</p>
            {!isFix ? (
              <button
                type="button"
                onClick={() => {
                  setManualOpen(false);
                  setCost("");
                  setWeight("");
                  setWeightUnit("oz");
                }}
                className="text-sm text-zinc-500 underline"
              >
                접기
              </button>
            ) : null}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-sm text-zinc-600">
                원가 (USD){isFix ? " *" : ""}
              </span>
              <input
                type="number"
                min={0.01}
                step="0.01"
                required={isFix}
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="예: 41.98"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm text-zinc-600">무게</span>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder={
                    weightUnit === "oz"
                      ? "예: 5.92"
                      : weightUnit === "lb"
                        ? "예: 1.25"
                        : "예: 800"
                  }
                  className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base"
                />
                <select
                  value={weightUnit}
                  onChange={(e) => setWeightUnit(e.target.value as WeightUnit)}
                  className="w-[7.5rem] shrink-0 rounded-lg border border-zinc-300 bg-white px-2 py-2.5 text-sm"
                  aria-label="무게 단위"
                >
                  <option value="oz">oz (ounces)</option>
                  <option value="lb">lb (pounds)</option>
                  <option value="g">g</option>
                </select>
              </div>
              {weightGramsPreview != null ? (
                <span className="block text-sm text-zinc-500">
                  → {weightGramsPreview.toLocaleString("ko-KR")}g (몰테일 계산용)
                </span>
              ) : (
                <span className="block text-sm text-zinc-500">
                  Amazon이 ounces면 oz, pounds면 lb 선택 (예: 5.92 ounces →
                  5.92+oz / 1.25 pounds → 1.25+lb)
                </span>
              )}
            </label>
          </div>
          <p className="text-sm text-zinc-500">
            원가는 판매가·마진에, 무게는 몰테일 국제배송비에 반영됩니다.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={busy || (!isFix && !url.trim()) || (isFix && !cost.trim())}
          className={`rounded-full px-5 py-2.5 text-base text-white disabled:opacity-40 ${
            isFix ? "bg-amber-800" : "bg-sky-800"
          }`}
        >
          {busy ? "적용 중…" : isFix ? "원가·무게 반영" : "Amazon 적용"}
        </button>
      </div>
      <p className="text-sm text-zinc-500">
        {isFix
          ? "수동 값을 넣으면 폴백($29.99)·기본 무게 대신 그 값으로 몰테일·시장성을 다시 계산합니다."
          : "자동 조회가 되면 원가·무게는 비워도 됩니다. 실패 시 + 수동 입력으로 넣으세요."}
      </p>
      {okMsg ? <p className="text-sm text-emerald-800">{okMsg}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
