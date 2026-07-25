"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SyncAllButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/shipments/sync-all", { method: "POST" });
      const data = (await res.json()) as {
        error?: string;
        total?: number;
        succeeded?: number;
        failed?: number;
      };
      if (!res.ok) throw new Error(data.error ?? "일괄 동기화 실패");
      setMessage(
        `일괄 동기화: ${data.succeeded ?? 0}/${data.total ?? 0} 성공` +
          (data.failed ? ` · 실패 ${data.failed}` : ""),
      );
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={busy}
        onClick={run}
        className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-sm disabled:opacity-40"
      >
        {busy ? "전체 동기화 중…" : "배대지 전체 동기화"}
      </button>
      {message ? <p className="text-sm text-zinc-600">{message}</p> : null}
    </div>
  );
}
