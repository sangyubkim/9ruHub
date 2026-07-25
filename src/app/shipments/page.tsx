import Link from "next/link";
import { listOrders } from "@/lib/orders/service";
import { listShipments } from "@/lib/shipments/service";
import { CreateShipmentForm } from "@/app/shipments/CreateShipmentForm";
import { ShipmentActions } from "@/app/shipments/ShipmentActions";

export const dynamic = "force-dynamic";

export default async function ShipmentsPage() {
  const [shipments, orders] = await Promise.all([listShipments(), listOrders()]);
  const orderOptions = orders
    .filter((o) => !o.shipment)
    .map((o) => ({
      id: o.id,
      label: o.externalOrderId ?? o.id.slice(0, 10),
    }));

  return (
    <div className="space-y-8">
      <section className="max-w-2xl">
        <h2 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
          물류 / 배대지
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          shipments 테이블 기준으로 배대지 입고·추적·채널 송장 자동등록을
          어댑터(기본 스텁)로 연결합니다.
        </p>
      </section>

      <CreateShipmentForm orders={orderOptions} />

      <section className="space-y-3">
        {shipments.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-300 bg-white/60 p-8 text-sm text-zinc-500">
            배송건이 없습니다. 주문을 선택한 뒤 배대지를 생성하세요.
          </p>
        ) : (
          shipments.map((shipment) => (
            <article
              key={shipment.id}
              className="rounded-2xl border border-zinc-200 bg-white/80 p-5"
            >
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <p className="text-xs text-zinc-500">{shipment.status}</p>
                  <h3 className="font-semibold">
                    주문{" "}
                    <Link
                      href={`/orders/${shipment.orderId}`}
                      className="underline"
                    >
                      {shipment.order.externalOrderId ??
                        shipment.orderId.slice(0, 10)}
                    </Link>
                  </h3>
                  <p className="mt-1 text-sm text-zinc-600">
                    배대지: {shipment.forwarderCode ?? "—"} /{" "}
                    {shipment.forwarderTrackingNo ?? "—"}
                  </p>
                  <p className="text-sm text-zinc-600">
                    국내송장: {shipment.localCarrier ?? "—"}{" "}
                    {shipment.localTrackingNo ?? ""} · 채널등록{" "}
                    {shipment.channelInvoiceStatus}
                  </p>
                </div>
              </div>
              <ShipmentActions shipmentId={shipment.id} />
            </article>
          ))
        )}
      </section>
    </div>
  );
}
