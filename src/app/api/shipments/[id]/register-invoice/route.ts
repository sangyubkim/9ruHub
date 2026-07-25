import { NextResponse } from "next/server";
import {
  parseChannelList,
  registerInvoiceToChannels,
} from "@/lib/shipments/invoice-pipeline";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      channels?: unknown;
      localCarrier?: string;
      localTrackingNo?: string;
    };
    const result = await registerInvoiceToChannels(id, {
      channels: parseChannelList(body.channels),
      localCarrier: body.localCarrier?.trim(),
      localTrackingNo: body.localTrackingNo?.trim(),
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "송장 채널 등록 실패",
      },
      { status: 400 },
    );
  }
}
