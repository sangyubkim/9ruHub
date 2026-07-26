export type AmazonPaapiConfig = {
  accessKey: string;
  secretKey: string;
  partnerTag: string;
  /** 예: www.amazon.com */
  marketplace: string;
  /** 예: webservices.amazon.com */
  host: string;
  /** 예: us-east-1 */
  region: string;
};

export function hasAmazonPaapiCredentials(): boolean {
  return Boolean(
    process.env.AMAZON_PAAPI_ACCESS_KEY?.trim() &&
      process.env.AMAZON_PAAPI_SECRET_KEY?.trim() &&
      process.env.AMAZON_PAAPI_PARTNER_TAG?.trim(),
  );
}

export function getAmazonPaapiConfig(): AmazonPaapiConfig | null {
  if (!hasAmazonPaapiCredentials()) return null;
  return {
    accessKey: process.env.AMAZON_PAAPI_ACCESS_KEY!.trim(),
    secretKey: process.env.AMAZON_PAAPI_SECRET_KEY!.trim(),
    partnerTag: process.env.AMAZON_PAAPI_PARTNER_TAG!.trim(),
    marketplace:
      process.env.AMAZON_PAAPI_MARKETPLACE?.trim() || "www.amazon.com",
    host: process.env.AMAZON_PAAPI_HOST?.trim() || "webservices.amazon.com",
    region: process.env.AMAZON_PAAPI_REGION?.trim() || "us-east-1",
  };
}
