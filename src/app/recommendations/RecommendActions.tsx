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
  const [busy, setBusy] = useState<"accept" | "ignore" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "accept" | "ignore") {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/recommendations/${id}/${action}`, {
        method: "POST",
      });
      const data = (await res.json()) as { error?: string; draftId?: string; next?: string };
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

  const locked =
    status === "IGNORED" || status === "DRAFT_CREATED" || status === "CONVERTED";

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
      {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
