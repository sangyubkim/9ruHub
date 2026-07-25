"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Preview = {
  titleKo: string;
  keywords: string[];
  detailHtml: string;
  options: Array<{ name: string; values: string[]; nameEn?: string }>;
  noticeText: string;
  translationNote: string;
  sourceLang: string;
  usedGpt: boolean;
  product: {
    asin: string | null;
    sourceUrl: string | null;
    title: string;
    brand: string | null;
    sourcePriceUsd: number | null;
    salePriceKrw: number | null;
    inStock: boolean;
    images: string[];
    isFallbackData: boolean;
  };
};

export default function AiDetailPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState<"preview" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onPreview(e: React.FormEvent) {
    e.preventDefault();
    setLoading("preview");
    setError(null);
    setPreview(null);
    try {
      const res = await fetch("/api/ai/detail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "생성 실패");
      setPreview(data.preview as Preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "생성 실패");
    } finally {
      setLoading(null);
    }
  }

  async function onSave() {
    if (!url.trim()) return;
    setLoading("save");
    setError(null);
    try {
      const res = await fetch("/api/ai/detail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, save: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장 실패");
      router.push(`/drafts/${data.draft.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-3xl">
          AI 상세페이지 제작
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Amazon US URL 한 개로 한국어 제목·키워드·상세 HTML·옵션·번역 메모를
          생성합니다. OPENAI_API_KEY가 없으면 고품질 템플릿으로 폴백합니다.
        </p>
      </div>

      <form
        onSubmit={onPreview}
        className="space-y-4 rounded-2xl border border-zinc-200 bg-white/90 p-6 shadow-sm"
      >
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">상품 URL / ASIN</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.amazon.com/dp/B0XXXXXXX 또는 B0XXXXXXX"
            className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 outline-none ring-sky-500 focus:ring-2"
            required
          />
        </label>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={!!loading}
            className="rounded-full bg-sky-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-sky-900 disabled:opacity-60"
          >
            {loading === "preview" ? "생성 중..." : "AI 상세 생성"}
          </button>
          <Link
            href="/drafts/new"
            className="rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm hover:border-sky-500"
          >
            기본 URL 초안
          </Link>
        </div>
      </form>

      {preview ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-zinc-600">
              {preview.usedGpt ? "GPT 생성" : "템플릿 폴백"} · 원문{" "}
              {preview.sourceLang}
              {preview.product.isFallbackData ? " · 수집 폴백 데이터" : ""}
            </div>
            <button
              type="button"
              disabled={!!loading}
              onClick={() => void onSave()}
              className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              {loading === "save" ? "저장 중..." : "초안으로 저장"}
            </button>
          </div>

          <section className="rounded-2xl border border-zinc-200 bg-white/90 p-5">
            <h3 className="font-semibold">제목</h3>
            <p className="mt-2 text-lg">{preview.titleKo}</p>
            {preview.product.salePriceKrw != null ? (
              <p className="mt-1 text-sm text-zinc-600">
                예상 판매가{" "}
                {preview.product.salePriceKrw.toLocaleString("ko-KR")}원
                {preview.product.sourcePriceUsd != null
                  ? ` · 원가 $${preview.product.sourcePriceUsd}`
                  : ""}
              </p>
            ) : null}
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white/90 p-5">
            <h3 className="font-semibold">키워드</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {preview.keywords.map((kw) => (
                <span
                  key={kw}
                  className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs"
                >
                  {kw}
                </span>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white/90 p-5">
            <h3 className="font-semibold">옵션</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {preview.options.map((opt) => (
                <li key={`${opt.name}-${opt.nameEn ?? ""}`}>
                  <strong>{opt.name}</strong>
                  {opt.nameEn && opt.nameEn !== opt.name
                    ? ` (${opt.nameEn})`
                    : ""}
                  : {opt.values.join(", ")}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white/90 p-5">
            <h3 className="font-semibold">번역 메모</h3>
            <p className="mt-2 text-sm text-zinc-700">
              {preview.translationNote}
            </p>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white/90 p-5">
            <h3 className="font-semibold">상세 미리보기</h3>
            <div
              className="prose prose-sm mt-3 max-w-none text-zinc-800"
              dangerouslySetInnerHTML={{ __html: preview.detailHtml }}
            />
          </section>
        </div>
      ) : null}
    </div>
  );
}
