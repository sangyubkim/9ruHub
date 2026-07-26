"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RecommendCleanupBar({
  activeCount,
  ignoredCount = 0,
}: {
  activeCount: number;
  ignoredCount?: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(
    mode: "pending_stub" | "keep_top" | "pending" | "purge_ignored",
    confirmText: string,
  ) {
    if (!window.confirm(confirmText)) return;
    setBusy(mode);
    setMessage(null);
    try {
      const res = await fetch("/api/recommendations/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          keepTop: 20,
          discoverOnly: true,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        ignored?: number;
        kept?: number;
        deleted?: number;
        candidatesDeleted?: number;
      };
      if (!res.ok) throw new Error(data.error ?? "정리 실패");
      if (mode === "purge_ignored") {
        setMessage(
          `${data.deleted ?? 0}건 삭제` +
            (data.candidatesDeleted
              ? ` · 후보 ${data.candidatesDeleted}건 삭제`
              : ""),
        );
      } else {
        setMessage(
          `${data.ignored ?? 0}건 무시 처리` +
            (data.kept != null && data.kept > 0 ? ` · ${data.kept}건 유지` : ""),
        );
      }
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "오류");
    } finally {
      setBusy(null);
    }
  }

  if (activeCount === 0 && ignoredCount === 0) return null;

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-xs text-zinc-600">
          활성 {activeCount}건
          {ignoredCount > 0 ? ` · 무시됨 ${ignoredCount}건` : ""}
          {" · "}
          무시=숨김 / 삭제=DB에서 제거
        </p>
        {activeCount > 0 ? (
          <>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() =>
                run(
                  "pending_stub",
                  "대기 중(STUB) 발굴 추천을 모두 무시할까요?",
                )
              }
              className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs disabled:opacity-40"
            >
              {busy === "pending_stub" ? "처리 중…" : "STUB만 무시"}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() =>
                run(
                  "keep_top",
                  "점수 상위 20개만 남기고 나머지 대기 추천을 무시할까요?",
                )
              }
              className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs disabled:opacity-40"
            >
              {busy === "keep_top" ? "처리 중…" : "상위 20만 남기기"}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() =>
                run(
                  "pending",
                  "대기 중(PENDING) 발굴 추천을 모두 무시할까요? (초안 연결분 제외)",
                )
              }
              className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs disabled:opacity-40"
            >
              {busy === "pending" ? "처리 중…" : "대기 전부 무시"}
            </button>
          </>
        ) : null}
        {ignoredCount > 0 ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() =>
              run(
                "purge_ignored",
                "무시된 발굴 추천을 DB에서 모두 삭제할까요? (되돌릴 수 없음)",
              )
            }
            className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs text-red-700 disabled:opacity-40"
          >
            {busy === "purge_ignored" ? "삭제 중…" : "무시된 항목 삭제"}
          </button>
        ) : null}
      </div>
      {message ? (
        <p className="mt-2 text-xs text-zinc-600">{message}</p>
      ) : null}
    </div>
  );
}
