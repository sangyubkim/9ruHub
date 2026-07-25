import { NextResponse } from "next/server";
import { confirmAutoOrderPayment } from "@/lib/orders/auto-order";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      confirmPayment?: boolean;
    };
    const result = await confirmAutoOrderPayment(id, {
      confirmPayment: body.confirmPayment,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "결제 확인 실패",
      },
      { status: 400 },
    );
  }
}
