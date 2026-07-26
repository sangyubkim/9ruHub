"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function Attach1688CostForm({
  recommendationId,
  initialUrl,
}: {
  recommendationId: string;
  initialUrl?: string | null;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl ?? "");
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
        `/api/recommendations/${recommendationId}/supply-url`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            supplyUrl: url.trim(),
            costPriceCny: cost.trim() ? cost.trim() : undefined,
          }),
        },
      );
      const data = (await res.json()) as {
        error?: string;
        costPriceCny?: number;
        sellPriceKrw?: number;
        marginRate?: number;
        isStub?: boolean;
        isFallback?: boolean;
        label?: string;
        score?: number;
      };
      if (!res.ok) throw new Error(data.error ?? "적용 실패");
      setOkMsg(
        `실원가 ¥${data.costPriceCny} → ${data.sellPriceKrw?.toLocaleString("ko-KR")}원 · 마진 ${((data.marginRate ?? 0) * 100).toFixed(1)}% · ${data.label} ${data.score?.toFixed(1)}점${data.isFallback ? " (수동 원가)" : ""}${data.isStub ? " · STUB잔여" : ""}`,
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-3 space-y-2 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 p-3"
    >
      <p className="text-xs font-medium text-zinc-700">1688 실원가 붙이기</p>
      <input
        type="url"
        required
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://detail.1688.com/offer/....html"
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm"
      />
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          min={0.01}
          step="0.01"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          placeholder="수동 원가 CNY (자동 실패 시)"
          className="min-w-[12rem] flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={busy || !url.trim()}
          className="rounded-full bg-emerald-800 px-4 py-1.5 text-sm text-white disabled:opacity-40"
        >
          {busy ? "적용 중…" : "실원가 적용"}
        </button>
      </div>
      <p className="text-[11px] text-zinc-500">
        페이지에서 가격을 못 읽으면 수동 원가(CNY)를 함께 넣으세요. URL은 실제
        링크로 저장됩니다.
      </p>
      {okMsg ? <p className="text-xs text-emerald-800">{okMsg}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </form>
  );
}
