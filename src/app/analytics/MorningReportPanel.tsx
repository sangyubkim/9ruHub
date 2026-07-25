"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Report = {
  id: string;
  reportDate: string;
  narrative: string;
  usedGpt: boolean;
  insights: unknown;
};

export function MorningReportPanel({
  initialReport,
}: {
  initialReport: Report | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState(initialReport);

  async function generate(force: boolean) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analytics/morning-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "생성 실패");
      setReport({
        id: data.report.id,
        reportDate: data.report.reportDate,
        narrative: data.report.narrative,
        usedGpt: data.report.usedGpt,
        insights: data.report.insights,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "생성 실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/90 to-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-amber-950">AI 운영 비서 · 아침 보고서</h3>
          <p className="mt-1 text-sm text-zinc-600">
            매출 변화·경쟁가·재고·광고 인사이트를 코드로 집계하고, GPT는 문장만
            다듬습니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => generate(false)}
            className="rounded-full bg-amber-800 px-4 py-2 text-sm text-white hover:bg-amber-900 disabled:opacity-60"
          >
            {loading ? "생성 중..." : "오늘 보고서 생성"}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => generate(true)}
            className="rounded-full border border-amber-300 bg-white px-4 py-2 text-sm text-amber-900 disabled:opacity-60"
          >
            강제 재생성
          </button>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

      {report ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs text-zinc-500">
            기준일 {new Date(report.reportDate).toLocaleDateString("ko-KR")} ·{" "}
            {report.usedGpt ? "GPT 문장" : "템플릿 문장"}
          </p>
          <pre className="whitespace-pre-wrap rounded-xl border border-amber-100 bg-white/80 p-4 text-sm leading-relaxed text-zinc-800">
            {report.narrative}
          </pre>
        </div>
      ) : (
        <p className="mt-4 text-sm text-zinc-500">
          아직 생성된 아침 보고서가 없습니다. 버튼을 눌러 생성하세요.
        </p>
      )}
    </section>
  );
}
