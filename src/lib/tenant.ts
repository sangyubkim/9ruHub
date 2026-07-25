import { MemberRole, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  DEMO_TENANT_SLUG,
  DEMO_USER_EMAIL,
} from "@/lib/tenant-constants";

export { DEMO_TENANT_SLUG, DEMO_USER_EMAIL };

/**
 * SaaS 준비: 요청 컨텍스트에 테넌트가 없을 때 데모 테넌트를 보장한다.
 * (인증/세션은 Stage 5에서 고도화)
 */
export async function ensureDemoTenant() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: DEMO_TENANT_SLUG },
    create: {
      slug: DEMO_TENANT_SLUG,
      name: "Demo Tenant",
    },
    update: {},
  });

  const user = await prisma.user.upsert({
    where: { email: DEMO_USER_EMAIL },
    create: {
      email: DEMO_USER_EMAIL,
      name: "Demo Owner",
    },
    update: {},
  });

  await prisma.tenantMember.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: user.id,
      },
    },
    create: {
      tenantId: tenant.id,
      userId: user.id,
      role: MemberRole.OWNER,
    },
    update: {},
  });

  return { tenant, user };
}

export async function getDefaultTenantId(): Promise<string> {
  const { tenant } = await ensureDemoTenant();
  return tenant.id;
}

export async function getTenantPriceRule(tenantId: string) {
  return prisma.priceRule.findUnique({
    where: {
      tenantId_name: {
        tenantId,
        name: "default",
      },
    },
  });
}

export type UpsertProductFromDraftInput = {
  tenantId: string;
  sourceProductId: string;
  draftId: string;
  title: string;
  titleKo: string;
  brand?: string | null;
  sourceMall: "AMAZON_US" | "OTHER";
  sourceUrl: string;
  externalId: string;
  currency: string;
  sourcePrice: Prisma.Decimal | number;
  salePriceKrw: number;
  costKrw?: number;
  inStock: boolean;
  images: Prisma.InputJsonValue;
};

/**
 * SourceProduct + ProductDraft 생성 시 canonical products / price history 동기화
 */
export async function upsertProductFromDraft(input: UpsertProductFromDraftInput) {
  const costKrw = input.costKrw ?? null;
  const product = await prisma.product.upsert({
    where: {
      tenantId_sourceMall_externalId: {
        tenantId: input.tenantId,
        sourceMall: input.sourceMall,
        externalId: input.externalId,
      },
    },
    create: {
      tenantId: input.tenantId,
      sourceProductId: input.sourceProductId,
      draftId: input.draftId,
      title: input.title,
      titleKo: input.titleKo,
      brand: input.brand ?? null,
      status: "DRAFTING",
      sourceMall: input.sourceMall,
      sourceUrl: input.sourceUrl,
      externalId: input.externalId,
      currency: input.currency,
      sourcePrice: input.sourcePrice,
      salePriceKrw: input.salePriceKrw,
      costKrw,
      inStock: input.inStock,
      images: input.images,
    },
    update: {
      sourceProductId: input.sourceProductId,
      draftId: input.draftId,
      title: input.title,
      titleKo: input.titleKo,
      brand: input.brand ?? null,
      status: "DRAFTING",
      sourceUrl: input.sourceUrl,
      sourcePrice: input.sourcePrice,
      salePriceKrw: input.salePriceKrw,
      costKrw,
      inStock: input.inStock,
      images: input.images,
    },
  });

  await prisma.productPriceHistory.create({
    data: {
      tenantId: input.tenantId,
      productId: product.id,
      sourcePrice: input.sourcePrice,
      salePriceKrw: input.salePriceKrw,
      costKrw,
      currency: input.currency,
      inStock: input.inStock,
      note: "draft_upsert",
    },
  });

  return product;
}
