import { NextResponse } from "next/server";
import { purchaseOrderItems } from "@/lib/orders/service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const result = await purchaseOrderItems(id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "자동주문 실패" },
      { status: 400 },
    );
  }
}
