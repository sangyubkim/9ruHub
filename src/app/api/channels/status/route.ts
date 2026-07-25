import { NextResponse } from "next/server";
import {
  credentialWarningMessages,
  getChannelCredentialStatus,
} from "@/lib/channels";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = getChannelCredentialStatus();
  return NextResponse.json({
    status,
    warnings: credentialWarningMessages(status),
  });
}
