"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Breakdown = Record<string, unknown>;

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function DraftPricingPanel({
  draftId,
  salePriceKrw,
  breakdown,
  sourcePrice,
  currency,
}: {
  draftId: string;
  salePriceKrw: number;
  breakdown: Breakdown;
  sourcePrice: number;
  currency: string;
}) {
  const router = useRouter();
  const [competitors, setCompetitors] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    recommendedSalePriceKrw: number;
    explanation: string;
    strategyCode: string;
    chinaShippingKrw: number;
    intlShippingKrw: number;
    dutyKrw: number;
    agencyFeeKrw: number;
    cardFeeKrw: number;
    platformFeeKrw: number;
    marginKrw: number;
    landedCostKrw: number;
  } | null>(null);

  const rows = useMemo(() => {
    const china = num(breakdown.chinaShippingKrw);
    const intl = num(breakdown.intlShippingKrw);
    const ship = num(breakdown.shippingFeeKrw);
    return [
      ["원가", num(breakdown.sourceCostKrw) ?? num(breakdown.sourcePriceKrw)],
      ["중국배송", china],
      ["국제배송", intl ?? (china == null ? ship : null)],
      ["배송(합)", ship],
      ["관세", num(breakdown.dutyKrw)],
      ["대행수수료", num(breakdown.agencyFeeKrw)],
      ["카드수수료", num(breakdown.cardFeeKrw)],
      ["플랫폼수수료", num(breakdown.platformFeeKrw)],
      ["마진", num(breakdown.marginKrw)],
      ["판매가", num(breakdown.salePriceKrw) ?? salePriceKrw],
    ] as const;
  }, [breakdown, salePriceKrw]);

  async function recommend(apply: boolean) {
    setLoading(true);
    setMessage(null);
    try {
      const china = num(breakdown.chinaShippingKrw) ?? 0;
      const intl =
        num(breakdown.intlShippingKrw) ?? num(breakdown.shippingFeeKrw) ?? 15000;
      const cost =
        num(breakdown.sourceCostKrw) ??
        num(breakdown.sourcePriceKrw) ??
        sourcePrice;

      const res = await fetch("/api/pricing/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cost,
          currency:
            num(breakdown.sourceCostKrw) != null ||
            num(breakdown.sourcePriceKrw) != null
              ? "KRW"
              : currency || "KRW",
          chinaShipping: china,
          intlShipping: intl,
          dutyRate:
            typeof breakdown.dutyRate === "number"
              ? breakdown.dutyRate
              : undefined,
          agencyFee: num(breakdown.agencyFeeKrw) ?? undefined,
          competitors: competitors
            .split(/[\s,;]+/)
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0),
          applyDraftId: apply ? draftId : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "추천 실패");
      setPreview(data.result);
      setMessage(
        apply
          ? `추천가 ${data.result.recommendedSalePriceKrw.toLocaleString("ko-KR")}원 적용`
          : "추천가를 계산했습니다. 「추천가 적용」으로 초안에 반영하세요.",
      );
      if (apply) router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "추천 실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white/90 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">AI 가격 결정 (추천 판매가)</h3>
        <a href="/pricing" className="text-sm text-sky-800">
          가격 도구 →
        </a>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        {rows.map(([label, value]) =>
          value == null ? null : (
            <div key={label}>
              <dt className="text-zinc-500">{label}</dt>
              <dd>{value.toLocaleString("ko-KR")}원</dd>
            </div>
          ),
        )}
      </dl>

      {typeof breakdown.explanation === "string" ? (
        <p className="mt-3 rounded-xl bg-zinc-50 p-3 text-sm text-zinc-700">
          {breakdown.explanation}
        </p>
      ) : null}

      <label className="mt-4 block text-sm">
        <span className="mb-1 block text-zinc-600">
          경쟁상품 가격 (선택, 쉼표 구분)
        </span>
        <input
          className="w-full rounded-xl border border-zinc-300 px-3 py-2"
          placeholder="59000, 62000, 65000"
          value={competitors}
          onChange={(e) => setCompetitors(e.target.value)}
        />
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => void recommend(false)}
          className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm disabled:opacity-50"
        >
          추천가 계산
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void recommend(true)}
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          추천가 적용
        </button>
      </div>

      {preview ? (
        <div className="mt-4 space-y-2 text-sm">
          <p className="text-lg font-semibold">
            추천 {preview.recommendedSalePriceKrw.toLocaleString("ko-KR")}원
          </p>
          <p className="text-zinc-600">{preview.explanation}</p>
        </div>
      ) : null}
      {message ? <p className="mt-2 text-sm text-zinc-600">{message}</p> : null}
    </section>
  );
}
