import { Channel } from "@/generated/prisma/client";
import { CoupangAdapter } from "./coupang";
import { SmartStoreAdapter } from "./smartstore";
import type { ChannelAdapter } from "./types";

const adapters: Record<Channel, ChannelAdapter> = {
  SMARTSTORE: new SmartStoreAdapter(),
  COUPANG: new CoupangAdapter(),
};

export function getChannelAdapter(channel: Channel): ChannelAdapter {
  return adapters[channel];
}

export * from "./types";
export * from "./credentials";
