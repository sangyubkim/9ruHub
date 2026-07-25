"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateOrderForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function createSample() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "SMARTSTORE",
          externalOrderId: `DEMO-${Date.now()}`,
          customerName: "홍길동",
          shippingFeeKrw: 0,
          platformFeeKrw: 3000,
          items: [
            {
              title: "데모 구매대행 상품",
              quantity: 1,
              unitSalePriceKrw: 59000,
              unitCostKrw: 32000,
              sourceUrl: "https://www.amazon.com/dp/B0DEMO0001",
            },
          ],
        }),
      });
      const data = (await res.json()) as { error?: string; order?: { id: string } };
      if (!res.ok) throw new Error(data.error ?? "생성 실패");
      setMessage("샘플 주문 생성됨");
      router.push(`/orders/${data.order!.id}`);
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white/80 p-5">
      <button
        type="button"
        disabled={busy}
        onClick={createSample}
        className="rounded-full bg-sky-800 px-4 py-2 text-sm text-white disabled:opacity-40"
      >
        {busy ? "생성 중…" : "샘플 주문 생성"}
      </button>
      {message ? <p className="mt-2 text-sm text-zinc-600">{message}</p> : null}
    </section>
  );
}
