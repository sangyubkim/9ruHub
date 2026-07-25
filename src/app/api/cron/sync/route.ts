import { NextResponse } from "next/server";
import { syncAllLiveDrafts } from "@/lib/sync/scheduler";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    // 로컬 개발: 시크릿 없으면 허용
    return process.env.NODE_ENV !== "production";
  }

  const header =
    request.headers.get("authorization") ||
    request.headers.get("x-cron-secret") ||
    "";
  if (header === secret) return true;
  if (header === `Bearer ${secret}`) return true;
  return false;
}

async function handle(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;

  const result = await syncAllLiveDrafts({ limit });
  return NextResponse.json({ result });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
