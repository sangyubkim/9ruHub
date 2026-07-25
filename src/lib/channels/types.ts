export type ChannelProductMeta = {
  originProductNo?: string;
  channelProductNo?: string;
  sellerProductId?: string;
  vendorItemId?: string;
};

export type ChannelProductPayload = {
  title: string;
  salePriceKrw: number;
  detailHtml: string;
  images: string[];
  options: Array<{ name: string; values: string[] }>;
  noticeText: string;
  sourceUrl: string;
  externalId: string;
  inStock: boolean;
  /** 채널에 이미 등록된 외부 상품 ID (재등록/동기화용) */
  externalProductId?: string;
  meta?: ChannelProductMeta;
};

export type PublishResult = {
  success: boolean;
  externalProductId?: string;
  message: string;
  payload: ChannelProductPayload;
  mode: "stub" | "live";
  meta?: ChannelProductMeta;
};

export type SyncResult = {
  success: boolean;
  message: string;
  salePriceKrw?: number;
  inStock?: boolean;
  mode: "stub" | "live";
};

export interface ChannelAdapter {
  readonly channel: "SMARTSTORE" | "COUPANG";
  publish(payload: ChannelProductPayload): Promise<PublishResult>;
  syncPriceStock(payload: ChannelProductPayload): Promise<SyncResult>;
}
