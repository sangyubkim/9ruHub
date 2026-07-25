import { NextResponse } from "next/server";
import { syncAllShipmentsFromForwarder } from "@/lib/shipments/invoice-pipeline";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await syncAllShipmentsFromForwarder();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "배대지 일괄 동기화 실패",
      },
      { status: 400 },
    );
  }
}
