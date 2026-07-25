import { PrismaClient } from "@/generated/prisma/client";
import { createPrismaClient } from "@/lib/prisma-pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

/**
 * Recreate the singleton after Prisma local / pooler closes connections (P1017).
 * The exported `prisma` proxy always resolves to the current client.
 */
export async function resetPrismaClient(): Promise<PrismaClient> {
  const previous = globalForPrisma.prisma;
  globalForPrisma.prisma = undefined;
  if (previous) {
    try {
      await previous.$disconnect();
    } catch {
      // ignore disconnect errors from already-closed pools
    }
  }
  return getClient();
}

/** Live proxy so `resetPrismaClient()` is visible to all importers. */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, _receiver) {
    const client = getClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
});

if (process.env.NODE_ENV !== "production") {
  void getClient();
}
