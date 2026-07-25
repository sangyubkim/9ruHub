import { OrderStatus } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { getOrder, updateOrderStatus } from "@/lib/orders/service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) {
    return NextResponse.json({ error: "주문 없음" }, { status: 404 });
  }
  return NextResponse.json({ order });
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = (await request.json()) as { status?: string };
    const allowed = Object.values(OrderStatus) as string[];
    if (!body.status || !allowed.includes(body.status)) {
      return NextResponse.json({ error: "유효한 status 필요" }, { status: 400 });
    }
    const order = await updateOrderStatus(id, body.status as OrderStatus);
    return NextResponse.json({ order });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "업데이트 실패" },
      { status: 400 },
    );
  }
}
