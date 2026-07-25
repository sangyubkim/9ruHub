import { NextResponse } from "next/server";
import { trackShipment } from "@/lib/shipments/service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const result = await trackShipment(id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "추적 실패" },
      { status: 400 },
    );
  }
}
