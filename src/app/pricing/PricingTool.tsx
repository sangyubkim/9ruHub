"use client";

import { useState } from "react";

type RecommendResult = {
  sourceCostKrw: number;
  chinaShippingKrw: number;
  intlShippingKrw: number;
  dutyKrw: number;
  agencyFeeKrw: number;
  cardFeeKrw: number;
  platformFeeKrw: number;
  marginKrw: number;
  landedCostKrw: number;
  costPlusSaleKrw: number;
  recommendedSalePriceKrw: number;
  strategyCode: string;
  explanation: string;
  competitors: { min: number; avg: number; max: number; count: number } | null;
};

function parseCompetitors(raw: string): number[] {
  return raw
    .split(/[\s,;]+/)
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export function PricingTool({ draftId }: { draftId?: string }) {
  const [form, setForm] = useState({
    cost: 20000,
    chinaShipping: 3000,
    intlShipping: 12000,
    dutyRate: 0.08,
    cardFeeRate: 0.025,
    platformFeeRate: 0.1,
    agencyFee: 3000,
    marginRate: 0.2,
    competitors: "",
    currency: "KRW",
  });
  const [result, setResult] = useState<RecommendResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run(apply: boolean) {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/pricing/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cost: Number(form.cost),
          chinaShipping: Number(form.chinaShipping),
          intlShipping: Number(form.intlShipping),
          dutyRate: Number(form.dutyRate),
          cardFeeRate: Number(form.cardFeeRate),
          platformFeeRate: Number(form.platformFeeRate),
          agencyFee: Number(form.agencyFee),
          marginRate: Number(form.marginRate),
          competitors: parseCompetitors(form.competitors),
          currency: form.currency,
          applyDraftId: apply && draftId ? draftId : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "계산 실패");
      setResult(data.result);
      setMessage(
        apply && data.draft
          ? `추천가 ${data.result.recommendedSalePriceKrw.toLocaleString("ko-KR")}원을 초안에 적용했습니다.`
          : "추천가를 계산했습니다.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "계산 실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form
        className="space-y-3 rounded-2xl border border-zinc-200 bg-white/90 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void run(false);
        }}
      >
        <h3 className="font-semibold">원가·수수료 입력</h3>
        {(
          [
            ["cost", "상품가격(원가)"],
            ["chinaShipping", "중국배송비"],
            ["intlShipping", "국제배송비"],
            ["agencyFee", "대행수수료"],
            ["dutyRate", "관세율 (0~1)"],
            ["cardFeeRate", "카드수수료율"],
            ["platformFeeRate", "플랫폼수수료율"],
            ["marginRate", "마진율"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block text-sm">
            <span className="mb-1 block text-zinc-600">{label}</span>
            <input
              type="number"
              step="any"
              className="w-full rounded-xl border border-zinc-300 px-3 py-2"
              value={form[key]}
              onChange={(e) =>
                setForm((s) => ({ ...s, [key]: Number(e.target.value) }))
              }
            />
          </label>
        ))}
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600">통화</span>
          <select
            className="w-full rounded-xl border border-zinc-300 px-3 py-2"
            value={form.currency}
            onChange={(e) =>
              setForm((s) => ({ ...s, currency: e.target.value }))
            }
          >
            <option value="KRW">KRW</option>
            <option value="USD">USD</option>
            <option value="CNY">CNY</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600">
            경쟁상품 가격 (쉼표 구분, 원)
          </span>
          <input
            className="w-full rounded-xl border border-zinc-300 px-3 py-2"
            placeholder="59000, 62000, 65000"
            value={form.competitors}
            onChange={(e) =>
              setForm((s) => ({ ...s, competitors: e.target.value }))
            }
          />
        </label>
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {loading ? "계산 중..." : "추천가 계산"}
          </button>
          {draftId ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => void run(true)}
              className="rounded-full border border-sky-600 bg-sky-50 px-4 py-2 text-sm text-sky-900 disabled:opacity-50"
            >
              추천가 적용
            </button>
          ) : null}
        </div>
        {message ? <p className="text-sm text-zinc-600">{message}</p> : null}
      </form>

      <section className="rounded-2xl border border-zinc-200 bg-white/90 p-5">
        <h3 className="font-semibold">비용 분해 / 추천 판매가</h3>
        {!result ? (
          <p className="mt-3 text-sm text-zinc-500">
            왼쪽 값을 입력한 뒤 계산하세요. 숫자는 규칙 엔진이 결정합니다.
          </p>
        ) : (
          <div className="mt-3 space-y-4 text-sm">
            <p className="text-2xl font-semibold tracking-tight">
              {result.recommendedSalePriceKrw.toLocaleString("ko-KR")}원
            </p>
            <dl className="grid grid-cols-2 gap-2">
              <div>
                <dt className="text-zinc-500">원가</dt>
                <dd>{result.sourceCostKrw.toLocaleString("ko-KR")}원</dd>
              </div>
              <div>
                <dt className="text-zinc-500">중국배송</dt>
                <dd>{result.chinaShippingKrw.toLocaleString("ko-KR")}원</dd>
              </div>
              <div>
                <dt className="text-zinc-500">국제배송</dt>
                <dd>{result.intlShippingKrw.toLocaleString("ko-KR")}원</dd>
              </div>
              <div>
                <dt className="text-zinc-500">관세</dt>
                <dd>{result.dutyKrw.toLocaleString("ko-KR")}원</dd>
              </div>
              <div>
                <dt className="text-zinc-500">대행수수료</dt>
                <dd>{result.agencyFeeKrw.toLocaleString("ko-KR")}원</dd>
              </div>
              <div>
                <dt className="text-zinc-500">착륙원가</dt>
                <dd>{result.landedCostKrw.toLocaleString("ko-KR")}원</dd>
              </div>
              <div>
                <dt className="text-zinc-500">카드수수료</dt>
                <dd>{result.cardFeeKrw.toLocaleString("ko-KR")}원</dd>
              </div>
              <div>
                <dt className="text-zinc-500">플랫폼수수료</dt>
                <dd>{result.platformFeeKrw.toLocaleString("ko-KR")}원</dd>
              </div>
              <div>
                <dt className="text-zinc-500">마진</dt>
                <dd>{result.marginKrw.toLocaleString("ko-KR")}원</dd>
              </div>
              <div>
                <dt className="text-zinc-500">cost-plus</dt>
                <dd>{result.costPlusSaleKrw.toLocaleString("ko-KR")}원</dd>
              </div>
            </dl>
            {result.competitors ? (
              <p className="text-zinc-600">
                경쟁가 밴드 {result.competitors.min.toLocaleString("ko-KR")} ~{" "}
                {result.competitors.max.toLocaleString("ko-KR")} (평균{" "}
                {result.competitors.avg.toLocaleString("ko-KR")})
              </p>
            ) : null}
            <p className="rounded-xl bg-zinc-50 p-3 text-zinc-700">
              {result.explanation}
            </p>
            <p className="font-mono text-xs text-zinc-500">
              strategy={result.strategyCode}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
