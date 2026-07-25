import type { DemandMall, SupplyMall } from "@/generated/prisma/client";

export type DemandMetrics = {
  mall: DemandMall;
  keyword: string;
  title: string;
  demandUrl?: string | null;
  externalDemandId?: string | null;
  searchVolume: number;
  competition: number; // 0–1 (higher = more competitive)
  reviewCount: number;
  rating: number; // 0–5
  salesEstimate: number;
  seasonalityScore: number; // 0–100
  isStub: boolean;
  raw?: Record<string, unknown>;
};

export type SupplyOffer = {
  mall: SupplyMall;
  title: string;
  supplyUrl?: string | null;
  externalSupplyId: string;
  /** Cost in CNY */
  costPriceCny: number;
  moq?: number;
  isStub: boolean;
  raw?: Record<string, unknown>;
};

export type JoinedCandidateMetrics = {
  keyword: string;
  title: string;
  sourceDemandMall: DemandMall;
  sourceSupplyMall: SupplyMall;
  demandUrl?: string | null;
  supplyUrl?: string | null;
  externalDemandId?: string | null;
  externalSupplyId: string;
  searchVolume: number;
  competition: number;
  reviewCount: number;
  rating: number;
  salesEstimate: number;
  costPriceCny: number;
  sellPriceKrw: number;
  marginRate: number;
  seasonalityScore: number;
  currency: string;
  isStub: boolean;
  rawMetrics: Record<string, unknown>;
};

export interface DemandMallAdapter {
  readonly name: string;
  readonly mall: DemandMall;
  fetchDemand(keyword: string): Promise<DemandMetrics>;
}

export interface SupplyMallAdapter {
  readonly name: string;
  readonly mall: SupplyMall;
  fetchSupplyOffers(keyword: string, limit?: number): Promise<SupplyOffer[]>;
}
