"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ChecklistItem = {
  status: string;
  label: string;
  done: boolean;
  current: boolean;
  awaitingConfirm: boolean;
};

type OrderEvent = {
  id: string;
  step: string;
  message: string;
  createdAt: string | Date;
};

export function OrderActions({
  orderId,
  status,
  checklist,
  events,
}: {
  orderId: string;
  status: string;
  checklist: ChecklistItem[];
  events: OrderEvent[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"start" | "confirm" | "legacy" | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [showEvents, setShowEvents] = useState(true);

  const awaiting = status === "AWAITING_PAYMENT_CONFIRM";
  const complete = status === "PURCHASE_COMPLETE";
  const cancelled = status === "CANCELLED" || status === "REFUNDED";

  async function startAutoOrder() {
    setBusy("start");
    setMessage(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/auto-order/start`, {
        method: "POST",
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error ?? "실패");
      setMessage(data.message ?? "자동주문 시작 완료(결제 게이트)");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(null);
    }
  }

  async function confirmPayment() {
    setBusy("confirm");
    setMessage(null);
    try {
      const res = await fetch(
        `/api/orders/${orderId}/auto-order/confirm-payment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmPayment: true }),
        },
      );
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error ?? "실패");
      setMessage(data.message ?? "결제 확인 후 파이프라인 완료");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(null);
    }
  }

  async function legacyPurchase() {
    setBusy("legacy");
    setMessage(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/purchase`, {
        method: "POST",
      });
      const data = (await res.json()) as {
        error?: string;
        results?: Array<{ mode: string; message: string }>;
      };
      if (!res.ok) throw new Error(data.error ?? "실패");
      setMessage(data.results?.[0]?.message ?? "레거시 자동주문 기록 완료");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-zinc-200 bg-white/80 p-5">
        <h3 className="font-semibold">자동주문 파이프라인</h3>
        <ol className="mt-3 space-y-2 text-sm">
          {checklist.map((step) => (
            <li
              key={step.status}
              className={`flex items-center gap-2 ${
                step.current ? "font-medium text-sky-900" : "text-zinc-600"
              }`}
            >
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs ${
                  step.done
                    ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                    : step.current
                      ? "border-sky-700 bg-sky-50 text-sky-800"
                      : "border-zinc-300 text-zinc-400"
                }`}
              >
                {step.done ? "✓" : step.current ? "●" : "○"}
              </span>
              <span>
                {step.label}
                {step.awaitingConfirm ? " — 확인 필요" : ""}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!!busy || cancelled || complete || awaiting}
          onClick={startAutoOrder}
          className="rounded-full bg-sky-800 px-4 py-2 text-sm text-white disabled:opacity-40"
        >
          {busy === "start" ? "진행 중…" : "자동주문 시작"}
        </button>
        <button
          type="button"
          disabled={!!busy || !awaiting}
          onClick={confirmPayment}
          className="rounded-full bg-amber-700 px-4 py-2 text-sm text-white disabled:opacity-40"
        >
          {busy === "confirm" ? "결제 처리 중…" : "결제 확인 후 계속"}
        </button>
        <button
          type="button"
          disabled={!!busy || cancelled}
          onClick={() => setShowEvents((v) => !v)}
          className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-800"
        >
          이벤트 로그 {showEvents ? "숨기기" : "보기"}
        </button>
        <button
          type="button"
          disabled={!!busy || cancelled}
          onClick={legacyPurchase}
          className="rounded-full border border-zinc-200 px-3 py-2 text-xs text-zinc-500 disabled:opacity-40"
        >
          {busy === "legacy" ? "요청 중…" : "레거시 스텁 구매"}
        </button>
      </div>

      {message ? <p className="text-sm text-zinc-600">{message}</p> : null}

      {showEvents ? (
        <section className="rounded-2xl border border-zinc-200 bg-white/80 p-5">
          <h3 className="font-semibold">이벤트 로그</h3>
          {events.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">아직 이벤트가 없습니다.</p>
          ) : (
            <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto text-sm">
              {events.map((ev) => (
                <li
                  key={ev.id}
                  className="border-t border-zinc-100 pt-2 text-zinc-700"
                >
                  <span className="font-mono text-xs text-zinc-500">
                    {new Date(ev.createdAt).toLocaleString("ko-KR")} · {ev.step}
                  </span>
                  <p>{ev.message}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
