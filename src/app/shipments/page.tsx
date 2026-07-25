import Link from "next/link";
import { listOrders } from "@/lib/orders/service";
import { listShipments } from "@/lib/shipments/service";
import { CreateShipmentForm } from "@/app/shipments/CreateShipmentForm";
import { ShipmentActions } from "@/app/shipments/ShipmentActions";
import { SyncAllButton } from "@/app/shipments/SyncAllButton";

export const dynamic = "force-dynamic";

type ChannelInvoiceEntry = {
  status?: string;
  mode?: string;
  message?: string;
  success?: boolean;
};

function channelInvoiceMap(
  payload: unknown,
): Record<string, ChannelInvoiceEntry> {
  if (!payload || typeof payload !== "object") return {};
  const channels = (payload as { channels?: Record<string, ChannelInvoiceEntry> })
    .channels;
  return channels && typeof channels === "object" ? channels : {};
}

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
          배대지 입고·출고·송장 수집 후 스마트스토어 / 쿠팡 / 11번가에 송장을
          자동 등록합니다. API 키 없으면 스텁으로 전체 플로우를 데모할 수
          있습니다.
        </p>
        <div className="mt-4">
          <SyncAllButton />
        </div>
      </section>

      <CreateShipmentForm orders={orderOptions} />

      <section className="space-y-3">
        {shipments.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-300 bg-white/60 p-8 text-sm text-zinc-500">
            배송건이 없습니다. 주문을 선택한 뒤 배대지를 생성하세요.
          </p>
        ) : (
          shipments.map((shipment) => {
            const byChannel = channelInvoiceMap(shipment.channelInvoicePayload);
            const channelKeys = Object.keys(byChannel);
            return (
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
                      {shipment.order.channel ? (
                        <span className="ml-2 text-xs font-normal text-zinc-500">
                          ({shipment.order.channel})
                        </span>
                      ) : null}
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
                    {channelKeys.length > 0 ? (
                      <ul className="mt-2 space-y-0.5 text-xs text-zinc-500">
                        {channelKeys.map((ch) => {
                          const row = byChannel[ch];
                          return (
                            <li key={ch}>
                              {ch}: {row?.status ?? "—"}
                              {row?.mode ? ` (${row.mode})` : ""}
                              {row?.message ? ` — ${row.message}` : ""}
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </div>
                </div>
                <ShipmentActions shipmentId={shipment.id} />
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
