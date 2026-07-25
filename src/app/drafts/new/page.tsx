"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewDraftPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "생성 실패");
      router.push(`/drafts/${data.draft.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "생성 실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-3xl">URL로 초안 생성</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Amazon US 상품 URL 또는 ASIN을 입력하면 스마트스토어/쿠팡용 초안을 만듭니다.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-2xl border border-zinc-200 bg-white/90 p-6 shadow-sm"
      >
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Amazon US URL / ASIN</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.amazon.com/dp/B0XXXXXXX 또는 B0XXXXXXX"
            className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 outline-none ring-sky-500 focus:ring-2"
            required
          />
        </label>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-sky-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-sky-900 disabled:opacity-60"
        >
          {loading ? "생성 중..." : "초안 생성"}
        </button>
      </form>
    </div>
  );
}
