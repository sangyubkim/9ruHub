"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function OpsAssistantForm() {
  const router = useRouter();
  const [question, setQuestion] = useState("이번 매출과 마진, 추천 성과를 요약해줘");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/analytics/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = (await res.json()) as { error?: string; answer?: string };
      if (!res.ok) throw new Error(data.error ?? "실패");
      setAnswer(data.answer ?? "");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        rows={3}
        className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={busy || !question.trim()}
        className="rounded-full bg-sky-800 px-4 py-2 text-sm text-white disabled:opacity-40"
      >
        {busy ? "분석 중…" : "DB 기준으로 설명 요청"}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {answer ? (
        <pre className="whitespace-pre-wrap rounded-xl bg-zinc-50 p-3 text-sm text-zinc-800">
          {answer}
        </pre>
      ) : null}
    </form>
  );
}
