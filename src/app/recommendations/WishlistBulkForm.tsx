"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  parseWishlistLines,
  WISHLIST_MAX_ITEMS,
  type WishlistBulkResult,
} from "@/lib/recommend/wishlist-bulk-parse";

export function WishlistBulkForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<WishlistBulkResult | null>(null);

  const preview = useMemo(() => parseWishlistLines(text), [text]);
  const readyCount = preview.items.length;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    setSummary(null);
    try {
      const res = await fetch("/api/recommendations/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = (await res.json()) as WishlistBulkResult & {
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "처리 실패");
      setSummary(data);
      setText("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-sky-200 bg-sky-50/40 p-5">
      <h3 className="text-sm font-semibold text-sky-950">
        위시리스트 · ASIN/URL 일괄
      </h3>
      <p className="mt-1 text-xs text-sky-950/70">
        Amazon URL 또는 ASIN을 한 줄에 하나씩 붙여넣으면 추천 카드를 만들고,
        가능하면 US/KR 배송 적합성도 함께 조회합니다. 한 번에 최대{" "}
        {WISHLIST_MAX_ITEMS}건 · 순차 처리(약 1초 간격).
      </p>

      <form onSubmit={onSubmit} className="mt-3 space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder={
            "https://www.amazon.com/dp/B0XXXXXXXX\nB0YYYYYYYY\n# 주석 줄은 무시됩니다"
          }
          className="w-full rounded-xl border border-sky-200 bg-white px-3 py-2 font-mono text-sm"
          disabled={busy}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={busy || readyCount === 0}
            className="rounded-full bg-sky-800 px-4 py-2 text-sm text-white disabled:opacity-40"
          >
            {busy
              ? `처리 중… (최대 ${readyCount || WISHLIST_MAX_ITEMS}건)`
              : `일괄 추천 생성 (${readyCount}건)`}
          </button>
          {preview.truncated ? (
            <span className="text-xs text-amber-800">
              {WISHLIST_MAX_ITEMS}건 초과분은 이번 실행에서 제외됩니다.
            </span>
          ) : null}
        </div>
      </form>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      {summary ? (
        <div className="mt-4 space-y-2 rounded-xl border border-sky-100 bg-white/90 p-4">
          <p className="text-sm font-medium text-zinc-800">
            결과 · 생성 {summary.created} · 스킵 {summary.skipped} · 실패{" "}
            {summary.failed} · 무효 {summary.invalid}
            {summary.truncated ? " · 상한 초과 있음" : ""}
          </p>
          <ul className="max-h-48 space-y-1 overflow-auto text-xs text-zinc-600">
            {summary.results.map((r, idx) => (
              <li key={`${r.asin || r.raw}-${idx}`}>
                <span className="font-medium text-zinc-800">
                  {r.asin || r.raw}
                </span>
                {" · "}
                {r.status === "created"
                  ? `생성${r.sourcingFitCode ? ` · ${r.sourcingFitCode}` : ""}${r.isFallback ? " · FALLBACK" : ""}`
                  : r.status === "skipped"
                    ? `스킵${r.reason ? ` (${r.reason})` : ""}`
                    : r.status === "invalid"
                      ? `무효${r.reason ? ` (${r.reason})` : ""}`
                      : `실패${r.reason ? ` (${r.reason})` : ""}`}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-zinc-500">
            배송 적합성은 best-effort입니다. 조회 실패 시에도 추천은 만들어지며
            「구매대행 적합만」 필터에는 적합 코드가 붙은 항목만 보입니다.
          </p>
        </div>
      ) : null}
    </section>
  );
}
