"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function DraftActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/channels/status")
      .then((res) => res.json())
      .then((data: { warnings?: string[] }) => {
        if (!cancelled) setWarnings(data.warnings ?? []);
      })
      .catch(() => {
        if (!cancelled) setWarnings([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function run(action: "ready" | "approve" | "publish" | "sync") {
    setLoading(action);
    setMessage(null);
    try {
      if (action === "ready") {
        const res = await fetch(`/api/drafts/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "READY" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "실패");
        setMessage("검수 완료(READY)로 변경했습니다.");
      }

      if (action === "approve") {
        const res = await fetch(`/api/drafts/${id}/approve`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "실패");
        setMessage("승인 완료");
      }

      if (action === "publish") {
        const res = await fetch(`/api/drafts/${id}/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "실패");
        const lines = (data.results as Array<{
          channel: string;
          message: string;
          success: boolean;
          mode?: string;
        }>).map(
          (r) =>
            `${r.channel}${r.mode ? `(${r.mode})` : ""}: ${r.success ? "OK" : "FAIL"} — ${r.message}`,
        );
        setMessage(lines.join(" / "));
      }

      if (action === "sync") {
        const res = await fetch(`/api/drafts/${id}/sync`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "실패");
        const syncLines = (
          (data.result.syncResults as Array<{
            channel: string;
            message: string;
            success: boolean;
            mode?: string;
          }>) ?? []
        ).map(
          (r) =>
            `${r.channel}${r.mode ? `(${r.mode})` : ""}: ${r.success ? "OK" : "FAIL"} — ${r.message}`,
        );
        setMessage(
          [
            `동기화 완료 — ${data.result.salePriceKrw.toLocaleString("ko-KR")}원 / 재고 ${
              data.result.inStock ? "있음" : "없음"
            }`,
            ...syncLines,
          ].join(" / "),
        );
      }

      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "처리 실패");
    } finally {
      setLoading(null);
    }
  }

  async function handleDelete() {
    if (!confirm("이 초안을 삭제할까요? 목록에서 숨겨지며 되돌릴 수 없습니다.")) {
      return;
    }
    setLoading("delete");
    setMessage(null);
    try {
      const res = await fetch(`/api/drafts/${id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "삭제 실패");
      router.push("/drafts");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "삭제 실패");
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white/90 p-5">
      <h3 className="font-semibold">워크플로 액션</h3>
      {warnings.length > 0 ? (
        <ul className="space-y-1 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {warnings.map((w) => (
            <li key={w}>⚠ {w}</li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!!loading || status === "PUBLISHED"}
          onClick={() => run("ready")}
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm hover:border-sky-500 disabled:opacity-50"
        >
          {loading === "ready" ? "처리 중..." : "검수완료(READY)"}
        </button>
        <button
          type="button"
          disabled={!!loading || !["DRAFT", "READY"].includes(status)}
          onClick={() => run("approve")}
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm hover:border-sky-500 disabled:opacity-50"
        >
          {loading === "approve" ? "처리 중..." : "승인"}
        </button>
        <button
          type="button"
          disabled={!!loading || !["APPROVED", "PUBLISHED"].includes(status)}
          onClick={() => run("publish")}
          className="rounded-full bg-sky-800 px-4 py-2 text-sm text-white hover:bg-sky-900 disabled:opacity-50"
        >
          {loading === "publish" ? "처리 중..." : "채널 등록(SS+쿠팡)"}
        </button>
        <button
          type="button"
          disabled={!!loading}
          onClick={() => run("sync")}
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm hover:border-sky-500 disabled:opacity-50"
        >
          {loading === "sync" ? "처리 중..." : "가격·품절 동기화"}
        </button>
        <button
          type="button"
          disabled={!!loading || status === "ARCHIVED"}
          onClick={() => void handleDelete()}
          className="rounded-full border border-red-300 px-4 py-2 text-sm text-red-700 hover:border-red-500 hover:bg-red-50 disabled:opacity-50"
        >
          {loading === "delete" ? "삭제 중..." : "삭제"}
        </button>
      </div>
      {message ? <p className="text-sm text-zinc-700">{message}</p> : null}
    </div>
  );
}
