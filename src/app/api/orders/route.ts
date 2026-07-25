import { Channel } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { createOrder, listOrders } from "@/lib/orders/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const items = await listOrders();
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      channel?: string;
      externalOrderId?: string;
      customerName?: string;
      customerPhone?: string;
      shippingFeeKrw?: number;
      platformFeeKrw?: number;
      notes?: string;
      items?: Array<{
        productId?: string;
        title: string;
        quantity: number;
        unitSalePriceKrw: number;
        unitCostKrw?: number;
        sourceUrl?: string;
      }>;
    };

    const channel =
      body.channel === "SMARTSTORE" || body.channel === "COUPANG"
        ? (body.channel as Channel)
        : undefined;

    const order = await createOrder({
      channel,
      externalOrderId: body.externalOrderId,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      shippingFeeKrw: body.shippingFeeKrw,
      platformFeeKrw: body.platformFeeKrw,
      notes: body.notes,
      items: body.items ?? [],
    });
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "주문 생성 실패" },
      { status: 400 },
    );
  }
}
