"use client";

import Link from "next/link";
import { useState } from "react";

type ImportResult = {
  total: number;
  success: number;
  failed: number;
  results: Array<{
    row: number;
    url: string;
    ok: boolean;
    draftId?: string;
    error?: string;
  }>;
};

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/drafts/import", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "가져오기 실패");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "가져오기 실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-3xl">엑셀 대량 등록</h2>
        <p className="mt-1 text-sm text-zinc-600">
          `url` 또는 `asin` 컬럼이 있는 엑셀로 초안을 일괄 생성합니다.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-2xl border border-zinc-200 bg-white/90 p-6"
      >
        <a
          href="/api/templates/excel"
          className="inline-flex text-sm text-sky-800 underline underline-offset-2"
        >
          템플릿 다운로드
        </a>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm"
          required
        />
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <button
          type="submit"
          disabled={loading || !file}
          className="rounded-full bg-sky-800 px-5 py-2.5 text-sm text-white disabled:opacity-60"
        >
          {loading ? "처리 중..." : "대량 초안 생성"}
        </button>
      </form>

      {result ? (
        <div className="rounded-2xl border border-zinc-200 bg-white/90 p-6">
          <p className="font-medium">
            총 {result.total}건 / 성공 {result.success} / 실패 {result.failed}
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {result.results.map((row) => (
              <li key={`${row.row}-${row.url}`} className="flex gap-3">
                <span className="text-zinc-400">#{row.row}</span>
                {row.ok && row.draftId ? (
                  <Link href={`/drafts/${row.draftId}`} className="text-sky-800 underline">
                    {row.url} 초안 보기
                  </Link>
                ) : (
                  <span className="text-rose-600">
                    {row.url || "(빈 값)"} — {row.error}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
