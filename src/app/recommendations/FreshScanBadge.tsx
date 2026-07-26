"use client";

import { useEffect, useState } from "react";

const HIGHLIGHT_KEY = "9ruhub.weeklyDiscover.highlightIds";

/** 이번 주 스캔으로 방금 반영된 추천에 NEW 표시 */
export function FreshScanBadge({ recommendationId }: { recommendationId: string }) {
  const [fresh, setFresh] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(HIGHLIGHT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { ids?: string[]; at?: string };
      const ids = parsed.ids ?? [];
      if (!ids.includes(recommendationId)) return;
      // 2시간 지나면 배지 숨김
      if (parsed.at) {
        const age = Date.now() - new Date(parsed.at).getTime();
        if (age > 2 * 60 * 60 * 1000) return;
      }
      setFresh(true);
    } catch {
      // ignore
    }
  }, [recommendationId]);

  if (!fresh) return null;
  return (
    <span className="ml-1 inline-flex rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
      NEW
    </span>
  );
}
