export type FetchedOption = {
  name: string;
  values: string[];
};

export type FetchedProduct = {
  asin: string;
  sourceUrl: string;
  title: string;
  brand: string | null;
  currency: string;
  sourcePrice: number;
  inStock: boolean;
  images: string[];
  options: FetchedOption[];
  /** 파싱된 무게(g). Shipping Weight 우선 */
  weightGrams?: number | null;
  isFallback: boolean;
  raw?: Record<string, unknown>;
};
