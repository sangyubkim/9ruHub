import { PricingTool } from "./PricingTool";

export const dynamic = "force-dynamic";

export default function PricingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-3xl">
          AI 가격 결정
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600">
          원가·중국/국제배송·관세·카드/플랫폼 수수료·마진으로 cost-plus를 계산한 뒤,
          경쟁상품 가격 밴드를 참고해 추천 판매가를 정합니다. (규칙 엔진, GPT 불필요)
        </p>
      </div>
      <PricingTool />
    </div>
  );
}
