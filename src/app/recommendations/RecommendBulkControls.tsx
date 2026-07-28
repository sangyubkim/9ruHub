"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type BulkCtx = {
  selected: Set<string>;
  toggle: (id: string) => void;
  selectIds: (ids: string[]) => void;
  clear: () => void;
  rejectIds: string[];
};

const Ctx = createContext<BulkCtx | null>(null);

export function RecommendBulkProvider({
  rejectIds,
  children,
}: {
  rejectIds: string[];
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectIds = useCallback((ids: string[]) => {
    setSelected(new Set(ids));
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  const value = useMemo(
    () => ({ selected, toggle, selectIds, clear, rejectIds }),
    [selected, toggle, selectIds, clear, rejectIds],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function useBulk() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("RecommendBulkProvider 필요");
  return ctx;
}

export function RecommendSelectCheckbox({ id }: { id: string }) {
  const { selected, toggle } = useBulk();
  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-zinc-600">
      <input
        type="checkbox"
        checked={selected.has(id)}
        onChange={() => toggle(id)}
        className="rounded border-zinc-300"
      />
      선택
    </label>
  );
}

export function RecommendBulkToolbar() {
  const router = useRouter();
  const { selected, selectIds, clear, rejectIds } = useBulk();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function deleteSelected() {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!window.confirm(`선택한 ${ids.length}건을 삭제할까요?`)) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/recommendations/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "delete_ids",
          ids,
          discoverOnly: true,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        deleted?: number;
        candidatesDeleted?: number;
      };
      if (!res.ok) throw new Error(data.error ?? "삭제 실패");
      setMessage(
        `${data.deleted ?? 0}건 삭제` +
          (data.candidatesDeleted
            ? ` · 후보 ${data.candidatesDeleted}건`
            : ""),
      );
      clear();
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs">
      <button
        type="button"
        disabled={busy || rejectIds.length === 0}
        onClick={() => selectIds(rejectIds)}
        className="rounded-full border border-zinc-300 px-3 py-1 disabled:opacity-40"
      >
        비추천 전체 선택 ({rejectIds.length})
      </button>
      <button
        type="button"
        disabled={busy || selected.size === 0}
        onClick={() => void deleteSelected()}
        className="rounded-full border border-red-300 bg-red-50 px-3 py-1 font-medium text-red-800 disabled:opacity-40"
      >
        {busy ? "삭제 중…" : `선택 삭제 (${selected.size})`}
      </button>
      {selected.size > 0 ? (
        <button
          type="button"
          disabled={busy}
          onClick={clear}
          className="rounded-full border border-zinc-200 px-3 py-1 text-zinc-600"
        >
          선택 해제
        </button>
      ) : null}
      {message ? <span className="text-zinc-600">{message}</span> : null}
    </div>
  );
}
