"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AttachAmazonUrlForm({
  recommendationId,
  keywordHint,
}: {
  recommendationId: string;
  keywordHint?: string | null;
}) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [cost, setCost] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch(
        `/api/recommendations/${recommendationId}/amazon-url`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: url.trim(),
            costUsd: cost.trim() ? cost.trim() : undefined,
          }),
        },
      );
      const data = (await res.json()) as {
        error?: string;
        sourcePriceUsd?: number;
        salePriceKrw?: number;
        score?: number;
        label?: string;
        isFallback?: boolean;
        marketVerdict?: string | null;
        asin?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "적용 실패");
      setOkMsg(
        `ASIN ${data.asin} · $${data.sourcePriceUsd} → ${data.salePriceKrw?.toLocaleString("ko-KR")}원 · ${data.label} ${data.score?.toFixed(1)}점${data.marketVerdict ? ` · ${data.marketVerdict}` : ""}${data.isFallback ? " (FALLBACK·수동원가 권장)" : ""}`,
      );
      setUrl("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  const searchHint = keywordHint?.trim()
    ? `Amazon.com에서 「${keywordHint.trim()}」 검색 후 URL을 붙이세요.`
    : "Amazon.com 상품 URL 또는 ASIN을 붙이세요.";

  return (
    <form
      onSubmit={onSubmit}
      className="mt-3 space-y-2 rounded-xl border border-dashed border-sky-300 bg-sky-50/70 p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-medium text-sky-950">Amazon URL 붙이기</p>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">
          Amazon URL 필요
        </span>
      </div>
      <p className="text-[11px] text-sky-950/70">{searchHint}</p>
      <input
        type="text"
        required
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://www.amazon.com/dp/... 또는 ASIN"
        className="w-full rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-sm"
      />
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          min={0.01}
          step="0.01"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          placeholder="수동 원가 USD (자동 실패 시)"
          className="min-w-[12rem] flex-1 rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={busy || !url.trim()}
          className="rounded-full bg-sky-800 px-4 py-1.5 text-sm text-white disabled:opacity-40"
        >
          {busy ? "적용 중…" : "Amazon 적용"}
        </button>
      </div>
      <p className="text-[11px] text-zinc-500">
        PA-API/HTML로 실가를 못 읽으면 수동 USD를 함께 넣으세요. 적용 후
        몰테일·네이버 시세·시장성으로 카드가 갱신됩니다.
      </p>
      {okMsg ? <p className="text-xs text-emerald-800">{okMsg}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </form>
  );
}
