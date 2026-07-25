import type { ForwarderAddress } from "@/lib/orders/auto-order/types";

/**
 * 배대지 주소: env FORWARDER_ADDRESS_* (테넌트 설정 확장 전 기본값).
 * 시크릿이 아닌 배송지 플레이스홀더만 사용한다.
 */
export function getForwarderAddress(): ForwarderAddress {
  return {
    name: process.env.FORWARDER_ADDRESS_NAME?.trim() || "9ruHub Forwarder",
    phone: process.env.FORWARDER_ADDRESS_PHONE?.trim() || "000-0000-0000",
    country: process.env.FORWARDER_ADDRESS_COUNTRY?.trim() || "CN",
    province: process.env.FORWARDER_ADDRESS_PROVINCE?.trim() || "Guangdong",
    city: process.env.FORWARDER_ADDRESS_CITY?.trim() || "Guangzhou",
    district: process.env.FORWARDER_ADDRESS_DISTRICT?.trim() || "Baiyun",
    address1:
      process.env.FORWARDER_ADDRESS_LINE1?.trim() ||
      "Stub Forwarder Warehouse #1",
    address2: process.env.FORWARDER_ADDRESS_LINE2?.trim() || undefined,
    postalCode: process.env.FORWARDER_ADDRESS_POSTAL?.trim() || "510000",
  };
}
