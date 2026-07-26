"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RecommendActions({
  id,
  status,
  draftId,
}: {
  id: string;
  status: string;
  draftId?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<
    "accept" | "ignore" | "unignore" | "delete" | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "accept" | "ignore" | "unignore" | "delete") {
    if (action === "delete") {
      if (!window.confirm("이 추천을 DB에서 삭제할까요? (되돌릴 수 없음)")) {
        return;
      }
    }
    setBusy(action);
    setError(null);
    try {
      const path =
        action === "delete"
          ? `/api/recommendations/${id}/delete`
          : `/api/recommendations/${id}/${action}`;
      const res = await fetch(path, { method: "POST" });
      const data = (await res.json()) as {
        error?: string;
        draftId?: string;
        next?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "요청 실패");
      if (action === "accept" && data.next) {
        router.push(data.next);
        return;
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(null);
    }
  }

  if (status === "IGNORED") {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => run("unignore")}
          className="rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-sm disabled:opacity-40"
        >
          {busy === "unignore" ? "처리 중…" : "무시 취소"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => run("delete")}
          className="rounded-full border border-red-200 bg-white px-4 py-1.5 text-sm text-red-700 disabled:opacity-40"
        >
          {busy === "delete" ? "삭제 중…" : "삭제"}
        </button>
        {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
      </div>
    );
  }

  const locked = status === "DRAFT_CREATED" || status === "CONVERTED";

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={locked || busy !== null}
        onClick={() => run("accept")}
        className="rounded-full bg-sky-800 px-4 py-1.5 text-sm text-white disabled:opacity-40"
      >
        {busy === "accept"
          ? "초안 생성 중…"
          : draftId
            ? "원클릭 초안 연결"
            : "원클릭 초안 만들기"}
      </button>
      <button
        type="button"
        disabled={locked || busy !== null}
        onClick={() => run("ignore")}
        className="rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-sm disabled:opacity-40"
      >
        {busy === "ignore" ? "처리 중…" : "무시"}
      </button>
      {!locked ? (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => run("delete")}
          className="rounded-full border border-red-200 bg-white px-4 py-1.5 text-sm text-red-700 disabled:opacity-40"
        >
          {busy === "delete" ? "삭제 중…" : "삭제"}
        </button>
      ) : null}
      {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
