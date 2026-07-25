import { NextResponse } from "next/server";
import {
  createShipmentForOrder,
  listShipments,
} from "@/lib/shipments/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const items = await listShipments();
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      orderId?: string;
      weightGrams?: number;
      shippingCostKrw?: number;
    };
    if (!body.orderId) {
      return NextResponse.json({ error: "orderId 필요" }, { status: 400 });
    }
    const result = await createShipmentForOrder(body.orderId, {
      weightGrams: body.weightGrams,
      shippingCostKrw: body.shippingCostKrw,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "배송 생성 실패" },
      { status: 400 },
    );
  }
}
