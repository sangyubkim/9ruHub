export type ChinaMallPurchaseRequest = {
  orderItemId: string;
  title: string;
  quantity: number;
  sourceUrl?: string | null;
  maxCostKrw?: number;
  note?: string;
};

export type ChinaMallPurchaseResult = {
  success: boolean;
  mode: "stub" | "live";
  purchaseRef: string;
  status: "STUBBED" | "QUEUED" | "SUCCEEDED" | "FAILED";
  message: string;
  payload?: Record<string, unknown>;
};

export interface ChinaMallAdapter {
  readonly name: string;
  purchase(request: ChinaMallPurchaseRequest): Promise<ChinaMallPurchaseResult>;
}
