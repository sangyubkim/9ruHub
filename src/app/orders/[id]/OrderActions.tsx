"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function OrderActions({
  orderId,
  status,
}: {
  orderId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function purchase() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/purchase`, { method: "POST" });
      const data = (await res.json()) as {
        error?: string;
        results?: Array<{ mode: string; message: string }>;
      };
      if (!res.ok) throw new Error(data.error ?? "실패");
      setMessage(data.results?.[0]?.message ?? "자동주문 기록 완료");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={busy || status === "CANCELLED"}
        onClick={purchase}
        className="rounded-full bg-sky-800 px-4 py-2 text-sm text-white disabled:opacity-40"
      >
        {busy ? "요청 중…" : "중국몰 자동주문(스텁)"}
      </button>
      {message ? <p className="text-sm text-zinc-600">{message}</p> : null}
    </div>
  );
}
