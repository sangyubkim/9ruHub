import { NextResponse } from "next/server";
import {
  listSeedCategories,
  type DiscoverSeedCategory,
} from "@/lib/discover/seed-keywords";
import {
  runWeeklyDiscover,
  type WeeklySupplyMode,
} from "@/lib/discover/weekly-scan";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CATEGORIES = new Set<string>(["all", ...listSeedCategories()]);

function parseSupplyMode(raw: unknown): WeeklySupplyMode | undefined {
  if (raw === "legacy_1688" || raw === "demand_only") return raw;
  return undefined;
}

export async function GET() {
  return NextResponse.json({
    categories: listSeedCategories(),
    defaults: {
      category: "all",
      expandRelated: false,
      minScore: 40,
      supplyLimit: 1,
      seedLimit: null,
      supplyMode: "demand_only",
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      category?: string;
      expandRelated?: boolean;
      seedLimit?: number;
      maxRelatedPerSeed?: number;
      maxRelatedTotal?: number;
      supplyLimit?: number;
      minScore?: number;
      delayMs?: number;
      replacePending?: boolean;
      supplyMode?: string;
    };

    const categoryRaw = (body.category ?? "all").toLowerCase();
    if (!CATEGORIES.has(categoryRaw)) {
      return NextResponse.json(
        {
          error: `category는 all 또는 ${listSeedCategories().join(", ")}`,
        },
        { status: 400 },
      );
    }

    const result = await runWeeklyDiscover({
      category: categoryRaw as DiscoverSeedCategory | "all",
      expandRelated: Boolean(body.expandRelated),
      seedLimit: body.seedLimit,
      maxRelatedPerSeed: body.maxRelatedPerSeed,
      maxRelatedTotal: body.maxRelatedTotal,
      supplyLimit: body.supplyLimit,
      minScore: body.minScore,
      delayMs: body.delayMs,
      supplyMode: parseSupplyMode(body.supplyMode),
      // 기본: 이번 스캔 결과만 남기고 이전 PENDING 발굴 추천 정리
      replacePending: body.replacePending !== false,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "주간 자동 발굴 실패",
      },
      { status: 400 },
    );
  }
}
