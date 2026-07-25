import "dotenv/config";
import { ensureDemoTenant, getDefaultTenantId } from "../src/lib/tenant";
import { prisma } from "../src/lib/db";

async function main() {
  const { tenant } = await ensureDemoTenant();
  const id = await getDefaultTenantId();
  const [products, drafts, orders, recs] = await Promise.all([
    prisma.product.count({ where: { tenantId: id } }),
    prisma.productDraft.count({ where: { tenantId: id } }),
    prisma.order.count({ where: { tenantId: id } }),
    prisma.aiRecommendation.count({ where: { tenantId: id } }),
  ]);
  console.log(
    JSON.stringify(
      { ok: true, slug: tenant.slug, tenantId: id, products, drafts, orders, recs },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
