import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrder } from "@/lib/orders/service";
import { pipelineChecklist } from "@/lib/orders/auto-order";
import { OrderActions } from "@/app/orders/[id]/OrderActions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();

  const checklist = pipelineChecklist(order.status);

  return (
    <div className="space-y-6">
      <Link href="/orders" className="text-sm text-sky-800 underline">
        ← 주문 목록
      </Link>
      <section>
        <h2 className="font-[family-name:var(--font-display)] text-3xl">
          주문 {order.externalOrderId ?? order.id.slice(0, 10)}
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          상태 {order.status} · 채널 {order.channel ?? "MANUAL"} · 이익{" "}
          {order.profitKrw.toLocaleString("ko-KR")}원
        </p>
      </section>

      <OrderActions
        orderId={order.id}
        status={order.status}
        checklist={checklist}
        events={order.events}
      />

      <section className="rounded-2xl border border-zinc-200 bg-white/80 p-5">
        <h3 className="font-semibold">라인 아이템</h3>
        <ul className="mt-3 space-y-3 text-sm">
          {order.items.map((item) => (
            <li key={item.id} className="border-t border-zinc-100 pt-3">
              <p className="font-medium">{item.title}</p>
              <p className="text-zinc-600">
                {item.quantity}개 · 판매{" "}
                {item.unitSalePriceKrw.toLocaleString("ko-KR")}원 · 원가{" "}
                {item.unitCostKrw.toLocaleString("ko-KR")}원
              </p>
              <p className="text-xs text-zinc-500">
                구매: {item.purchaseStatus}
                {item.purchaseMall ? ` @ ${item.purchaseMall}` : ""}
                {item.purchaseRef ? ` / ${item.purchaseRef}` : ""}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
