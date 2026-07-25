"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DraftEditForm({
  id,
  titleKo,
  salePriceKrw,
  detailHtml,
  noticeText,
  reviewNote,
  keywords = [],
}: {
  id: string;
  titleKo: string;
  salePriceKrw: number;
  detailHtml: string;
  noticeText: string;
  reviewNote: string | null;
  keywords?: string[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    titleKo,
    salePriceKrw,
    detailHtml,
    noticeText,
    reviewNote: reviewNote ?? "",
    keywordsText: keywords.join(", "),
  });
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const parsedKeywords = form.keywordsText
        .split(/[,，]/)
        .map((k) => k.trim())
        .filter(Boolean);
      const res = await fetch(`/api/drafts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titleKo: form.titleKo,
          salePriceKrw: Number(form.salePriceKrw),
          detailHtml: form.detailHtml,
          noticeText: form.noticeText,
          reviewNote: form.reviewNote,
          keywords: parsedKeywords,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장 실패");
      setMessage("저장되었습니다.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "저장 실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-zinc-200 bg-white/90 p-5">
      <h3 className="font-semibold">초안 수정</h3>
      <label className="block text-sm">
        <span className="mb-1 block">한국어 제목</span>
        <input
          className="w-full rounded-xl border border-zinc-300 px-3 py-2"
          value={form.titleKo}
          onChange={(e) => setForm((s) => ({ ...s, titleKo: e.target.value }))}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block">키워드 (쉼표 구분)</span>
        <input
          className="w-full rounded-xl border border-zinc-300 px-3 py-2"
          value={form.keywordsText}
          onChange={(e) =>
            setForm((s) => ({ ...s, keywordsText: e.target.value }))
          }
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block">판매가(KRW)</span>
        <input
          type="number"
          className="w-full rounded-xl border border-zinc-300 px-3 py-2"
          value={form.salePriceKrw}
          onChange={(e) =>
            setForm((s) => ({ ...s, salePriceKrw: Number(e.target.value) }))
          }
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block">고지문구</span>
        <textarea
          rows={4}
          className="w-full rounded-xl border border-zinc-300 px-3 py-2"
          value={form.noticeText}
          onChange={(e) => setForm((s) => ({ ...s, noticeText: e.target.value }))}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block">상세 HTML</span>
        <textarea
          rows={10}
          className="w-full rounded-xl border border-zinc-300 px-3 py-2 font-mono text-xs"
          value={form.detailHtml}
          onChange={(e) => setForm((s) => ({ ...s, detailHtml: e.target.value }))}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block">검수 메모</span>
        <textarea
          rows={2}
          className="w-full rounded-xl border border-zinc-300 px-3 py-2"
          value={form.reviewNote}
          onChange={(e) => setForm((s) => ({ ...s, reviewNote: e.target.value }))}
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="rounded-full bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {loading ? "저장 중..." : "초안 저장"}
      </button>
      {message ? <p className="text-sm text-zinc-600">{message}</p> : null}
    </form>
  );
}
