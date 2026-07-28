"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type ScanRow = {
  keyword: string;
  source: "seed" | "related";
  topScore: number | null;
  topLabel: string | null;
  title: string | null;
  created: number;
  recommendationIds: string[];
  skippedPriceWar?: boolean;
  marketType?: string | null;
  message?: string;
  error?: string;
};

type ScanSummary = {
  finishedAt: string;
  category: string;
  scanned: number;
  seedCount: number;
  relatedCount: number;
  createdTotal: number;
  addedCount: number;
  failedCount: number;
  noHitCount: number;
  stubCount: number;
  awaitingAmazonCount?: number;
  skippedPriceWarCount?: number;
  scarceCreated?: number;
  unclearCreated?: number;
  supplyMode?: string;
  replacedIgnored?: number;
  minScore: number;
  results: ScanRow[];
  recommendationIds: string[];
};

const STORAGE_KEY = "9ruhub.weeklyDiscover.lastRun";

const CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "전체 시드" },
  { value: "seasonal_home", label: "계절가전/생활" },
  { value: "camping", label: "캠핑/아웃도어" },
  { value: "car", label: "차량용품" },
  { value: "kitchen", label: "주방/수납" },
  { value: "pet", label: "반려동물" },
  { value: "beauty", label: "뷰티/헬스" },
  { value: "office", label: "사무/디지털" },
];

type FilterTab = "all" | "added" | "noHit" | "failed" | "skipped";

export function WeeklyDiscoverForm() {
  const router = useRouter();
  const [category, setCategory] = useState("all");
  const [expandRelated, setExpandRelated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [tab, setTab] = useState<FilterTab>("added");

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as ScanSummary;
      if (parsed?.results) setSummary(parsed);
    } catch {
      // ignore
    }
  }, []);

  const filtered = useMemo(() => {
    if (!summary) return [];
    if (tab === "added") {
      return summary.results.filter((r) => r.created > 0 && !r.error);
    }
    if (tab === "skipped") {
      return summary.results.filter((r) => Boolean(r.skippedPriceWar));
    }
    if (tab === "noHit") {
      return summary.results.filter(
        (r) => !r.error && r.created === 0 && !r.skippedPriceWar,
      );
    }
    if (tab === "failed") {
      return summary.results.filter((r) => Boolean(r.error));
    }
    return summary.results;
  }, [summary, tab]);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/discover/weekly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          expandRelated,
          supplyMode: "demand_only",
          minScore: 40,
        }),
      });
      const data = (await res.json()) as ScanSummary & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "자동 발굴 실패");

      const next: ScanSummary = {
        finishedAt: data.finishedAt ?? new Date().toISOString(),
        category: data.category ?? category,
        scanned: data.scanned ?? 0,
        seedCount: data.seedCount ?? 0,
        relatedCount: data.relatedCount ?? 0,
        createdTotal: data.createdTotal ?? 0,
        addedCount: data.addedCount ?? 0,
        failedCount: data.failedCount ?? 0,
        noHitCount: data.noHitCount ?? 0,
        stubCount: data.stubCount ?? 0,
        awaitingAmazonCount: data.awaitingAmazonCount ?? 0,
        skippedPriceWarCount: data.skippedPriceWarCount ?? 0,
        scarceCreated: data.scarceCreated ?? 0,
        unclearCreated: data.unclearCreated ?? 0,
        supplyMode: data.supplyMode ?? "demand_only",
        replacedIgnored: data.replacedIgnored ?? 0,
        minScore: data.minScore ?? 40,
        results: data.results ?? [],
        recommendationIds: data.recommendationIds ?? [],
      };
      setSummary(next);
      setTab(next.addedCount > 0 ? "added" : "all");
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        if (next.recommendationIds.length > 0) {
          sessionStorage.setItem(
            "9ruhub.weeklyDiscover.highlightIds",
            JSON.stringify({
              ids: next.recommendationIds,
              at: next.finishedAt,
            }),
          );
        }
      } catch {
        // ignore
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
      <h3 className="text-sm font-semibold text-emerald-950">
        이번 주 추천 새로고침
      </h3>
      <p className="mt-1 text-xs text-emerald-950/70">
        시드 키워드의 네이버 수요만 스캔합니다. 추천 카드에 「Amazon URL
        필요」가 붙으면 Amazon.com에서 상품을 찾아 URL을 붙이세요. 이전
        대기(PENDING) 발굴 추천은 자동 정리됩니다.
      </p>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm"
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-xs text-emerald-950">
          <input
            type="checkbox"
            checked={expandRelated}
            onChange={(e) => setExpandRelated(e.target.checked)}
          />
          연관 키워드 확장 (검색광고)
        </label>

        <button
          type="button"
          disabled={busy}
          onClick={run}
          className="rounded-full bg-emerald-800 px-4 py-2 text-sm text-white disabled:opacity-40"
        >
          {busy ? "스캔 중… (1~3분, 끝나면 목록 표시)" : "이번 주 추천 새로고침"}
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      {summary ? (
        <div className="mt-4 space-y-3 rounded-xl border border-emerald-100 bg-white/90 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-zinc-800">
              최근 스캔 결과
              <span className="ml-2 text-xs font-normal text-zinc-500">
                {new Date(summary.finishedAt).toLocaleString("ko-KR")}
              </span>
            </p>
            <p className="text-xs text-zinc-500">
              카테고리 {summary.category} · 최소점수 {summary.minScore}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-lg bg-emerald-50 px-3 py-2">
              <dt className="text-zinc-500">검색한 키워드</dt>
              <dd className="text-base font-semibold text-emerald-950">
                {summary.scanned}
              </dd>
              <dd className="text-[11px] text-zinc-500">
                시드 {summary.seedCount}
                {summary.relatedCount > 0
                  ? ` + 연관 ${summary.relatedCount}`
                  : ""}
              </dd>
            </div>
            <div className="rounded-lg bg-emerald-50 px-3 py-2">
              <dt className="text-zinc-500">추천 반영</dt>
              <dd className="text-base font-semibold text-emerald-950">
                {summary.addedCount}키워드 / {summary.createdTotal}건
              </dd>
              <dd className="text-[11px] text-zinc-500">
                희소 {summary.scarceCreated ?? 0} · 불명확{" "}
                {summary.unclearCreated ?? 0}
              </dd>
            </div>
            <div className="rounded-lg bg-amber-50 px-3 py-2">
              <dt className="text-zinc-500">가격경쟁 스킵</dt>
              <dd className="text-base font-semibold text-amber-950">
                {summary.skippedPriceWarCount ?? 0}
              </dd>
            </div>
            <div className="rounded-lg bg-zinc-50 px-3 py-2">
              <dt className="text-zinc-500">점수 미달</dt>
              <dd className="text-base font-semibold text-zinc-800">
                {summary.noHitCount}
              </dd>
            </div>
            <div className="rounded-lg bg-zinc-50 px-3 py-2">
              <dt className="text-zinc-500">실패</dt>
              <dd className="text-base font-semibold text-zinc-800">
                {summary.failedCount}
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-2 text-xs">
            {(
              [
                ["added", `반영됨 (${summary.addedCount})`],
                [
                  "skipped",
                  `가격경쟁 스킵 (${summary.skippedPriceWarCount ?? 0})`,
                ],
                ["all", `전체 (${summary.scanned})`],
                ["noHit", `미달 (${summary.noHitCount})`],
                ["failed", `실패 (${summary.failedCount})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`rounded-full px-3 py-1 ${
                  tab === key
                    ? "bg-emerald-800 text-white"
                    : "border border-zinc-200 bg-white text-zinc-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="max-h-72 overflow-auto rounded-lg border border-zinc-100">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-3 py-2 font-medium">키워드</th>
                  <th className="px-3 py-2 font-medium">출처</th>
                  <th className="px-3 py-2 font-medium">결과</th>
                  <th className="px-3 py-2 font-medium">점수</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-6 text-center text-zinc-400"
                    >
                      이 필터에 해당하는 항목이 없습니다.
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => (
                    <tr
                      key={`${row.source}-${row.keyword}`}
                      className="border-t border-zinc-50"
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium text-zinc-800">
                          {row.keyword}
                        </div>
                        {row.title ? (
                          <div className="text-[11px] text-zinc-500">
                            {row.title}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-zinc-500">
                        {row.source === "related" ? "연관" : "시드"}
                      </td>
                      <td className="px-3 py-2">
                        {row.error ? (
                          <span className="text-red-600">실패</span>
                        ) : row.skippedPriceWar ? (
                          <span className="text-amber-800">가격경쟁 스킵</span>
                        ) : row.created > 0 ? (
                          <span className="text-emerald-800">
                            추천 {row.created}건 반영
                            {row.marketType ? ` · ${row.marketType}` : ""}
                          </span>
                        ) : (
                          <span className="text-zinc-500">
                            미달(추천 없음)
                          </span>
                        )}
                        {row.error ? (
                          <div className="mt-0.5 max-w-xs truncate text-[11px] text-red-500">
                            {row.error}
                          </div>
                        ) : null}
                        {row.skippedPriceWar && row.message ? (
                          <div className="mt-0.5 max-w-xs truncate text-[11px] text-amber-700">
                            {row.message}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-zinc-700">
                        {row.topLabel ?? "—"}
                        {row.topScore != null
                          ? ` ${row.topScore.toFixed(1)}`
                          : ""}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-zinc-500">
            아래 「추천 목록」에서 초록 NEW 배지가 붙은 항목이 이번 스캔으로
            갱신된 추천입니다.
            {summary.replacedIgnored
              ? ` · 이전 대기 추천 ${summary.replacedIgnored}건 정리됨`
              : ""}
            {(summary.awaitingAmazonCount ?? 0) > 0
              ? ` · Amazon URL 대기 ${summary.awaitingAmazonCount}키워드`
              : summary.stubCount > 0
                ? ` · 공급 스텁 ${summary.stubCount}키워드`
                : ""}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-zinc-500">
          아직 이 탭에서 스캔한 기록이 없습니다. 버튼을 누르면 검색·반영 목록이
          여기에 남습니다.
        </p>
      )}
    </section>
  );
}
