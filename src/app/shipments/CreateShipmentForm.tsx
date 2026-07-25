"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateShipmentForm({
  orders,
}: {
  orders: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const [orderId, setOrderId] = useState(orders[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!orderId) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, weightGrams: 500, shippingCostKrw: 8000 }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "실패");
      setMessage("배대지 배송건 생성 완료");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white/80 p-5 sm:flex-row sm:items-end"
    >
      <label className="flex-1 text-sm">
        주문 선택
        <select
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2"
        >
          {orders.length === 0 ? (
            <option value="">배송 가능한 주문 없음</option>
          ) : (
            orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))
          )}
        </select>
      </label>
      <button
        type="submit"
        disabled={!orderId || busy}
        className="rounded-full bg-sky-800 px-4 py-2 text-sm text-white disabled:opacity-40"
      >
        {busy ? "생성 중…" : "배대지 생성"}
      </button>
      {message ? <p className="w-full text-sm text-zinc-600">{message}</p> : null}
    </form>
  );
}
