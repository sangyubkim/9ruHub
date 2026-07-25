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
      const data = (await res.json()) as { error?: string; created?: number };
      if (!res.ok) throw new Error(data.error ?? "스캔 실패");
      setMessage(`${data.created ?? 0}건 추천 생성`);
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
        >
          {busy === "scan" ? "스캔 중…" : "기존 상품 스캔"}
        </button>
      </form>
      {message ? <p className="mt-3 text-sm text-zinc-600">{message}</p> : null}
    </section>
  );
}
