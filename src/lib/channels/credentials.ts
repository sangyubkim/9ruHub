export type ChannelCredentialStatus = {
  smartstore: {
    configured: boolean;
    missing: string[];
    productReady: boolean;
    productMissing: string[];
  };
  coupang: {
    configured: boolean;
    missing: string[];
    productReady: boolean;
    productMissing: string[];
  };
  elevenst: {
    configured: boolean;
    missing: string[];
    productReady: boolean;
    productMissing: string[];
  };
};

function missingOf(keys: string[]): string[] {
  return keys.filter((key) => !process.env[key]?.trim());
}

export function isSmartStoreConfigured(): boolean {
  return (
    Boolean(process.env.SMARTSTORE_CLIENT_ID?.trim()) &&
    Boolean(process.env.SMARTSTORE_CLIENT_SECRET?.trim())
  );
}

export function isCoupangConfigured(): boolean {
  return (
    Boolean(process.env.COUPANG_ACCESS_KEY?.trim()) &&
    Boolean(process.env.COUPANG_SECRET_KEY?.trim()) &&
    Boolean(process.env.COUPANG_VENDOR_ID?.trim())
  );
}

export function isElevenstConfigured(): boolean {
  return (
    Boolean(process.env.ELEVENST_API_KEY?.trim()) &&
    Boolean(
      process.env.ELEVENST_API_URL?.trim() ||
        process.env.ELEVENST_OPENAPI_URL?.trim(),
    )
  );
}

export function smartStoreProductMissing(): string[] {
  return missingOf([
    "SMARTSTORE_LEAF_CATEGORY_ID",
    "SMARTSTORE_SHIPPING_ADDRESS_ID",
    "SMARTSTORE_RETURN_ADDRESS_ID",
  ]);
}

export function coupangProductMissing(): string[] {
  return missingOf([
    "COUPANG_DISPLAY_CATEGORY_CODE",
    "COUPANG_OUTBOUND_SHIPPING_PLACE_CODE",
    "COUPANG_RETURN_CENTER_CODE",
    "COUPANG_RETURN_CHARGE_NAME",
    "COUPANG_COMPANY_CONTACT_NUMBER",
    "COUPANG_VENDOR_USER_ID",
  ]);
}

export function getChannelCredentialStatus(): ChannelCredentialStatus {
  const smartstoreAuthMissing = missingOf([
    "SMARTSTORE_CLIENT_ID",
    "SMARTSTORE_CLIENT_SECRET",
  ]);
  const coupangAuthMissing = missingOf([
    "COUPANG_ACCESS_KEY",
    "COUPANG_SECRET_KEY",
    "COUPANG_VENDOR_ID",
  ]);
  const smartProductMissing = smartStoreProductMissing();
  const coupangProductMissingKeys = coupangProductMissing();

  const elevenstAuthMissing = missingOf(["ELEVENST_API_KEY"]).concat(
    process.env.ELEVENST_API_URL?.trim() || process.env.ELEVENST_OPENAPI_URL?.trim()
      ? []
      : ["ELEVENST_API_URL"],
  );

  return {
    smartstore: {
      configured: smartstoreAuthMissing.length === 0,
      missing: smartstoreAuthMissing,
      productReady: smartstoreAuthMissing.length === 0 && smartProductMissing.length === 0,
      productMissing: smartProductMissing,
    },
    coupang: {
      configured: coupangAuthMissing.length === 0,
      missing: coupangAuthMissing,
      productReady: coupangAuthMissing.length === 0 && coupangProductMissingKeys.length === 0,
      productMissing: coupangProductMissingKeys,
    },
    elevenst: {
      configured: elevenstAuthMissing.length === 0,
      missing: elevenstAuthMissing,
      // 상품 등록 live는 스켈레톤 — 키만으로 invoice stub→live 전환
      productReady: false,
      productMissing: elevenstAuthMissing.length === 0 ? ["ELEVENST_CATEGORY_MAP"] : [],
    },
  };
}

export function credentialWarningMessages(status = getChannelCredentialStatus()): string[] {
  const messages: string[] = [];
  if (!status.smartstore.configured) {
    messages.push(
      "스마트스토어: CLIENT_ID/SECRET 미설정 → 스텁 등록(실제 전송 없음)",
    );
  } else if (!status.smartstore.productReady) {
    messages.push(
      `스마트스토어: 상품 등록용 env 부족 (${status.smartstore.productMissing.join(", ")})`,
    );
  }
  if (!status.coupang.configured) {
    messages.push("쿠팡: ACCESS/SECRET/VENDOR 미설정 → 스텁 등록(실제 전송 없음)");
  } else if (!status.coupang.productReady) {
    messages.push(
      `쿠팡: 상품 등록용 env 부족 (${status.coupang.productMissing.join(", ")})`,
    );
  }
  if (!status.elevenst.configured) {
    messages.push("11번가: API_KEY/URL 미설정 → 스텁 등록(실제 전송 없음)");
  }
  return messages;
}
