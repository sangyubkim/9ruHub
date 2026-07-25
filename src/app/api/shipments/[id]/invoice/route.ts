import { NextResponse } from "next/server";
import { registerChannelInvoice } from "@/lib/shipments/service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = (await request.json()) as {
      localCarrier?: string;
      localTrackingNo?: string;
    };
    if (!body.localCarrier?.trim() || !body.localTrackingNo?.trim()) {
      return NextResponse.json(
        { error: "localCarrier, localTrackingNo 필요" },
        { status: 400 },
      );
    }
    const result = await registerChannelInvoice(id, {
      localCarrier: body.localCarrier.trim(),
      localTrackingNo: body.localTrackingNo.trim(),
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "송장 등록 실패" },
      { status: 400 },
    );
  }
}
