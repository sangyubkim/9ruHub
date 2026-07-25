import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { AutoOrderStep } from "@/lib/orders/auto-order/types";

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function appendOrderEvent(input: {
  orderId: string;
  step: AutoOrderStep | string;
  message: string;
  payload?: Record<string, unknown>;
}) {
  return prisma.orderEvent.create({
    data: {
      orderId: input.orderId,
      step: input.step,
      message: input.message,
      payload: input.payload ? toJson(input.payload) : undefined,
    },
  });
}

export async function listOrderEvents(orderId: string) {
  return prisma.orderEvent.findMany({
    where: { orderId },
    orderBy: { createdAt: "asc" },
  });
}
