import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { estimateIntlShipping } from "@/lib/forwarder/shipping-estimate";
import { defaultPriceRuleFromEnv } from "@/lib/price-engine";
import { recommendSalePrice } from "@/lib/pricing/recommend";
import { getDefaultTenantId, getTenantPriceRule } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  cost: z.number().positive(),
  chinaShipping: z.number().nonnegative().optional(),
  intlShipping: z.number().nonnegative().optional(),
  /** g. 있으면 더베이 항공 요금표로 국제배송 추정 (intlShipping 미지정 시) */
  weightGrams: z.number().positive().optional(),
  region: z.enum(["CN", "US", "OTHER"]).optional(),
  duty: z.number().nonnegative().optional(),
  dutyRate: z.number().min(0).max(1).optional(),
  cardFeeRate: z.number().min(0).max(1).optional(),
  platformFeeRate: z.number().min(0).max(1).optional(),
  agencyFee: z.number().nonnegative().optional(),
  marginRate: z.number().min(0).max(2).optional(),
  minMarginRate: z.number().min(0).max(1).optional(),
  undercutRate: z.number().min(0).max(0.5).optional(),
  competitors: z.array(z.number().positive()).optional(),
  competitorMin: z.number().positive().optional(),
  competitorAvg: z.number().positive().optional(),
  competitorMax: z.number().positive().optional(),
  currency: z.string().min(3).max(3).optional(),
  roundTo: z.number().int().positive().optional(),
  /** 있으면 초안 salePriceKrw + costBreakdown 갱신 */
  applyDraftId: z.string().min(1).optional(),
});

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const tenantId = await getDefaultTenantId();
    const ruleRow = await getTenantPriceRule(tenantId);
    const envRule = defaultPriceRuleFromEnv();

    const chinaShipping =
      body.chinaShipping ??
      (ruleRow
        ? 0
        : (envRule.chinaShippingFeeKrw ?? 0));

    const currency = (body.currency ?? "KRW").toUpperCase();
    const region =
      body.region ??
      (currency === "CNY" ? "CN" : currency === "USD" ? "US" : "CN");
    const shippingQuote =
      body.intlShipping == null
        ? estimateIntlShipping({
            region,
            weightGrams: body.weightGrams,
          })
        : null;
    const intlShipping =
      body.intlShipping ??
      shippingQuote?.feeKrw ??
      (ruleRow?.shippingFeeKrw ?? envRule.shippingFeeKrw);

    const result = recommendSalePrice({
      cost: body.cost,
      chinaShipping,
      intlShipping,
      duty: body.duty,
      dutyRate: body.dutyRate ?? (ruleRow ? Number(ruleRow.dutyRate) : envRule.dutyRate),
      cardFeeRate:
        body.cardFeeRate ?? envRule.cardFeeRate ?? 0.025,
      platformFeeRate:
        body.platformFeeRate ??
        (ruleRow
          ? Number(ruleRow.platformFeeRate)
          : envRule.platformFeeRate),
      agencyFee:
        body.agencyFee ??
        (ruleRow?.agencyFeeKrw ?? envRule.agencyFeeKrw),
      marginRate:
        body.marginRate ??
        (ruleRow ? Number(ruleRow.marginRate) : envRule.marginRate),
      minMarginRate: body.minMarginRate ?? envRule.minMarginRate,
      undercutRate: body.undercutRate ?? envRule.undercutRate,
      competitors: body.competitors,
      competitorMin: body.competitorMin,
      competitorAvg: body.competitorAvg,
      competitorMax: body.competitorMax,
      currency,
      usdToKrw: ruleRow ? Number(ruleRow.usdToKrw) : envRule.usdToKrw,
      roundTo: body.roundTo ?? (ruleRow?.roundTo ?? envRule.roundTo),
    });

    const resultWithShipping = {
      ...result,
      shippingQuote: shippingQuote ?? {
        feeKrw: intlShipping,
        source: body.intlShipping != null ? "manual" : "env",
      },
      costBreakdown: {
        ...result.costBreakdown,
        shippingQuote: shippingQuote ?? {
          feeKrw: intlShipping,
          source: body.intlShipping != null ? "manual" : "env",
        },
      },
    };

    let draft = null;
    if (body.applyDraftId) {
      const existing = await prisma.productDraft.findFirst({
        where: { id: body.applyDraftId, tenantId },
      });
      if (!existing) {
        return NextResponse.json(
          {
            error: "초안을 찾을 수 없습니다.",
            result: resultWithShipping,
          },
          { status: 404 },
        );
      }
      draft = await prisma.productDraft.update({
        where: { id: existing.id },
        data: {
          salePriceKrw: resultWithShipping.recommendedSalePriceKrw,
          costBreakdown: toJson({
            ...(typeof existing.costBreakdown === "object" &&
            existing.costBreakdown !== null
              ? (existing.costBreakdown as Record<string, unknown>)
              : {}),
            ...resultWithShipping.costBreakdown,
          }),
        },
      });
    }

    return NextResponse.json({ result: resultWithShipping, draft });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "추천가 계산 실패";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
