import Link from "next/link";
import { listOrders } from "@/lib/orders/service";
import { CreateOrderForm } from "@/app/orders/CreateOrderForm";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const orders = await listOrders();

  return (
    <div className="space-y-8">
      <section className="max-w-2xl">
        <h2 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
          주문 관리
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          테넌트 단위 주문/라인아이템을 관리하고, 중국몰 자동주문은 어댑터
          스텁으로 시도 상태를 기록합니다(공식 API 없으면 실결제 없음).
        </p>
      </section>

      <CreateOrderForm />

      <section className="space-y-3">
        {orders.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-300 bg-white/60 p-8 text-sm text-zinc-500">
            주문이 없습니다. 아래에서 샘플 주문을 생성하세요.
          </p>
        ) : (
          orders.map((order) => (
            <article
              key={order.id}
              className="rounded-2xl border border-zinc-200 bg-white/80 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-zinc-500">
                    {order.channel ?? "MANUAL"} · {order.status}
                  </p>
                  <h3 className="mt-1 font-semibold">
                    <Link href={`/orders/${order.id}`} className="hover:underline">
                      {order.externalOrderId ?? order.id.slice(0, 10)}
                    </Link>
                  </h3>
                  <p className="mt-1 text-sm text-zinc-600">
                    {order.customerName ?? "고객미상"} · 매출{" "}
                    {order.subtotalKrw.toLocaleString("ko-KR")}원 · 이익{" "}
                    {order.profitKrw.toLocaleString("ko-KR")}원
                  </p>
                  <ul className="mt-2 text-sm text-zinc-700">
                    {order.items.map((item) => (
                      <li key={item.id}>
                        {item.title} × {item.quantity}{" "}
                        <span className="text-xs text-zinc-500">
                          ({item.purchaseStatus}
                          {item.purchaseRef ? ` / ${item.purchaseRef}` : ""})
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Link
                  href={`/orders/${order.id}`}
                  className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-sm"
                >
                  상세
                </Link>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
