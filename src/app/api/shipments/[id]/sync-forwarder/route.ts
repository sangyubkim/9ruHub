import { NextResponse } from "next/server";
import { syncShipmentFromForwarder } from "@/lib/shipments/invoice-pipeline";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const result = await syncShipmentFromForwarder(id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "배대지 동기화 실패",
      },
      { status: 400 },
    );
  }
}
