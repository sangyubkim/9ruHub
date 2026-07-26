"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type DiscoverItem = {
  candidateId: string;
  recommendationId: string;
  title: string;
  score: number;
  label: string;
  reasonText: string | null;
  isStub: boolean;
  metrics: {
    searchVolume: number;
    competition: number;
    marginRate: number;
    costPriceCny: number;
    sellPriceKrw: number;
    rating: number;
    reviewCount: number;
  };
};

export function DiscoverKeywordForm() {
  const router = useRouter();
  const [keyword, setKeyword] = useState("무선선풍기");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [items, setItems] = useState<DiscoverItem[]>([]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword }),
      });
      const data = (await res.json()) as {
        error?: string;
        created?: number;
        isStub?: boolean;
        items?: DiscoverItem[];
      };
      if (!res.ok) throw new Error(data.error ?? "발굴 실패");
      setItems(data.items ?? []);
      setMessage(
        `${data.created ?? 0}건 발굴${data.isStub ? " (스텁 메트릭)" : ""}`,
      );
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-sky-200 bg-sky-50/60 p-5">
      <h3 className="text-sm font-semibold text-sky-900">키워드 수동 발굴</h3>
      <p className="mt-1 text-xs text-sky-900/70">
        특정 키워드만 빠르게 검증할 때 사용합니다. 자동 발굴은 위 「이번 주 추천
        새로고침」을 쓰세요.
      </p>
      <form onSubmit={submit} className="mt-3 flex flex-col gap-3 sm:flex-row">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="예: 무선선풍기"
          className="flex-1 rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={!keyword.trim() || busy}
          className="rounded-full bg-sky-800 px-4 py-2 text-sm text-white disabled:opacity-40"
        >
          {busy ? "발굴 중…" : "발굴 실행"}
        </button>
      </form>
      {message ? <p className="mt-3 text-sm text-zinc-700">{message}</p> : null}

      {items.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li
              key={item.candidateId}
              className="rounded-xl border border-sky-100 bg-white/80 px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{item.title}</span>
                <span className="text-xs text-sky-800">
                  {item.label} · {item.score.toFixed(1)}점
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-600">
                검색량 {item.metrics.searchVolume.toLocaleString("ko-KR")} · 경쟁{" "}
                {item.metrics.competition.toFixed(2)} · 마진{" "}
                {(item.metrics.marginRate * 100).toFixed(1)}% · ¥
                {item.metrics.costPriceCny} →{" "}
                {item.metrics.sellPriceKrw.toLocaleString("ko-KR")}원
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
