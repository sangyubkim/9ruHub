import type { LocalizedOption } from "@/lib/ai-detail/options";

export type AiDetailInput = {
  title: string;
  brand?: string | null;
  sourceUrl?: string | null;
  asin?: string | null;
  sourcePriceUsd?: number | null;
  salePriceKrw?: number | null;
  inStock?: boolean;
  images?: string[];
  options?: Array<{ name: string; values: string[] }>;
  bullets?: string[];
  categoryHint?: string | null;
  sourceLang?: string;
};

export type AiDetailContent = {
  titleKo: string;
  keywords: string[];
  detailHtml: string;
  options: LocalizedOption[];
  noticeText: string;
  translationNote: string;
  sourceLang: string;
  usedGpt: boolean;
};

export type AiDetailPreview = AiDetailContent & {
  product: {
    asin: string | null;
    sourceUrl: string | null;
    title: string;
    brand: string | null;
    sourcePriceUsd: number | null;
    salePriceKrw: number | null;
    inStock: boolean;
    images: string[];
    isFallbackData: boolean;
  };
};
