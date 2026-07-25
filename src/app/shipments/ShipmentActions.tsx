"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ShipmentActions({ shipmentId }: { shipmentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"track" | "invoice" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function track() {
    setBusy("track");
    setMessage(null);
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/track`, {
        method: "POST",
      });
      const data = (await res.json()) as { error?: string; track?: { message: string } };
      if (!res.ok) throw new Error(data.error ?? "추적 실패");
      setMessage(data.track?.message ?? "추적 갱신");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(null);
    }
  }

  async function invoice() {
    setBusy("invoice");
    setMessage(null);
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          localCarrier: "CJ대한통운",
          localTrackingNo: `KR${Date.now()}`,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        invoice?: { message: string };
      };
      if (!res.ok) throw new Error(data.error ?? "송장 등록 실패");
      setMessage(data.invoice?.message ?? "송장 등록 완료");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <button
        type="button"
        disabled={busy !== null}
        onClick={track}
        className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-sm disabled:opacity-40"
      >
        {busy === "track" ? "추적 중…" : "배대지 추적"}
      </button>
      <button
        type="button"
        disabled={busy !== null}
        onClick={invoice}
        className="rounded-full bg-sky-800 px-3 py-1.5 text-sm text-white disabled:opacity-40"
      >
        {busy === "invoice" ? "등록 중…" : "송장 자동등록(스텁)"}
      </button>
      {message ? <p className="w-full text-sm text-zinc-600">{message}</p> : null}
    </div>
  );
}
