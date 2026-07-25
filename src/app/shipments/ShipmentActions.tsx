"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ShipmentActions({ shipmentId }: { shipmentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<
    "sync" | "invoice" | "track" | "syncAll" | null
  >(null);
  const [message, setMessage] = useState<string | null>(null);

  async function syncForwarder() {
    setBusy("sync");
    setMessage(null);
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/sync-forwarder`, {
        method: "POST",
      });
      const data = (await res.json()) as {
        error?: string;
        shipment?: { status: string; localTrackingNo?: string | null };
        steps?: Array<{ step?: string; message?: string }>;
      };
      if (!res.ok) throw new Error(data.error ?? "배대지 동기화 실패");
      const last = data.steps?.[data.steps.length - 1];
      setMessage(
        last?.message ??
          `동기화 완료 · ${data.shipment?.status}${
            data.shipment?.localTrackingNo
              ? ` · ${data.shipment.localTrackingNo}`
              : ""
          }`,
      );
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(null);
    }
  }

  async function registerInvoice() {
    setBusy("invoice");
    setMessage(null);
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/register-invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channels: ["SMARTSTORE", "COUPANG", "ELEVENST"],
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        channelInvoiceStatus?: string;
        results?: Array<{ channel: string; message: string }>;
      };
      if (!res.ok) throw new Error(data.error ?? "송장 등록 실패");
      const summary =
        data.results?.map((r) => `${r.channel}:${r.message}`).join(" · ") ??
        data.channelInvoiceStatus ??
        "송장 등록 완료";
      setMessage(summary);
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(null);
    }
  }

  async function track() {
    setBusy("track");
    setMessage(null);
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/track`, {
        method: "POST",
      });
      const data = (await res.json()) as {
        error?: string;
        track?: { message: string };
      };
      if (!res.ok) throw new Error(data.error ?? "추적 실패");
      setMessage(data.track?.message ?? "추적 갱신");
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
        onClick={syncForwarder}
        className="rounded-full bg-sky-800 px-3 py-1.5 text-sm text-white disabled:opacity-40"
      >
        {busy === "sync" ? "동기화 중…" : "배대지 동기화"}
      </button>
      <button
        type="button"
        disabled={busy !== null}
        onClick={registerInvoice}
        className="rounded-full border border-sky-800 bg-white px-3 py-1.5 text-sm text-sky-900 disabled:opacity-40"
      >
        {busy === "invoice" ? "등록 중…" : "송장 채널등록"}
      </button>
      <button
        type="button"
        disabled={busy !== null}
        onClick={track}
        className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-sm disabled:opacity-40"
      >
        {busy === "track" ? "추적 중…" : "배대지 추적"}
      </button>
      {message ? <p className="w-full text-sm text-zinc-600">{message}</p> : null}
    </div>
  );
}
