"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RecommendGenerateForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<"url" | "scan" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submitUrl(e: React.FormEvent) {
    e.preventDefault();
    setBusy("url");
    setMessage(null);
    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "생성 실패");
      setUrl("");
      setMessage("URL 추천이 생성되었습니다.");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "오류");
    } finally {
      setBusy(null);
    }
  }

  async function scanExisting() {
    setBusy("scan");
    setMessage(null);
    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generate: true, limit: 20, minScore: 40 }),
      });
      const data = (await res.json()) as {
        error?: string;
        created?: number;
        scanned?: number;
      };
      if (!res.ok) throw new Error(data.error ?? "스캔 실패");
      const created = data.created ?? 0;
      const scanned = data.scanned ?? 0;
      setMessage(
        created > 0
          ? `Amazon 상품 ${scanned}건 중 ${created}건 추천 생성`
          : scanned === 0
            ? "재점수할 Amazon 상품이 DB에 없습니다. URL을 먼저 넣어 주세요."
            : "새 추천 없음(이미 추천됐거나 점수 미달).",
      );
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "오류");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white/80 p-5">
      <form onSubmit={submitUrl} className="flex flex-col gap-3 sm:flex-row">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.amazon.com/dp/..."
          className="flex-1 rounded-xl border border-zinc-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={!url.trim() || busy !== null}
          className="rounded-full bg-sky-800 px-4 py-2 text-sm text-white disabled:opacity-40"
        >
          {busy === "url" ? "분석 중…" : "URL 추천 생성"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={scanExisting}
          className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm disabled:opacity-40"
          title="DB에 저장된 Amazon US 상품만 다시 점수 매깁니다"
        >
          {busy === "scan" ? "재점수 중…" : "Amazon DB 재점수"}
        </button>
      </form>
      <p className="mt-2 text-xs text-zinc-500">
        「Amazon DB 재점수」는 1688/시드 도매 오퍼를 제외한 Amazon 상품만
        대상입니다.
      </p>
      {message ? <p className="mt-3 text-sm text-zinc-600">{message}</p> : null}
    </section>
  );
}
