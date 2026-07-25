import Link from "next/link";
import type { AnalyticsPeriod } from "@/lib/analytics/metrics";

const OPTIONS: Array<{ value: AnalyticsPeriod; label: string }> = [
  { value: "today", label: "오늘" },
  { value: "7d", label: "7일" },
  { value: "30d", label: "30일" },
  { value: "all", label: "전체" },
];

export function PeriodToggle({ period }: { period: AnalyticsPeriod }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {OPTIONS.map((opt) => {
        const active = opt.value === period;
        return (
          <Link
            key={opt.value}
            href={`/analytics?period=${opt.value}`}
            className={
              active
                ? "rounded-full bg-sky-800 px-3.5 py-1.5 text-sm font-medium text-white"
                : "rounded-full border border-zinc-300 bg-white px-3.5 py-1.5 text-sm text-zinc-700 hover:border-sky-500"
            }
          >
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}
