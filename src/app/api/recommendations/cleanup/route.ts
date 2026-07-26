import { NextResponse } from "next/server";
import {
  cleanupRecommendations,
  type CleanupMode,
} from "@/lib/recommend/cleanup";

export const dynamic = "force-dynamic";

const MODES = new Set<CleanupMode>([
  "pending",
  "pending_stub",
  "keep_top",
  "pending_except_ids",
  "purge_ignored",
]);

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      mode?: string;
      keepTop?: number;
      exceptIds?: string[];
      discoverOnly?: boolean;
    };

    const mode = (body.mode ?? "pending") as CleanupMode;
    if (!MODES.has(mode)) {
      return NextResponse.json(
        {
          error:
            "mode는 pending | pending_stub | keep_top | pending_except_ids | purge_ignored",
        },
        { status: 400 },
      );
    }

    const result = await cleanupRecommendations({
      mode,
      keepTop: body.keepTop,
      exceptIds: body.exceptIds,
      discoverOnly: body.discoverOnly ?? true,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "정리 실패",
      },
      { status: 400 },
    );
  }
}
