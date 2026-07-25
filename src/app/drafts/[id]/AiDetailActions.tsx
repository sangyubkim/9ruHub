"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AiDetailActions({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function regenerate() {
    if (
      !confirm(
        "AI로 제목·키워드·상세 HTML·옵션을 다시 생성해 저장할까요? 현재 내용이 덮어씌워집니다.",
      )
    ) {
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/drafts/${id}/ai-detail`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "재생성 실패");
      const usedGpt = data.content?.usedGpt ? "GPT" : "템플릿";
      setMessage(`AI 상세 재생성 완료 (${usedGpt})`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "재생성 실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-sky-950">AI 상세페이지</h3>
          <p className="mt-1 text-sm text-sky-900/80">
            제목·SEO 키워드·상세 HTML·옵션명을 다시 생성합니다.
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void regenerate()}
          className="rounded-full bg-sky-800 px-4 py-2 text-sm text-white hover:bg-sky-900 disabled:opacity-50"
        >
          {loading ? "생성 중..." : "AI 상세 재생성"}
        </button>
      </div>
      {message ? <p className="mt-3 text-sm text-sky-950">{message}</p> : null}
    </div>
  );
}
