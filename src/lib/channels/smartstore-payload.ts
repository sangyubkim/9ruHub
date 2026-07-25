import type { ChannelProductPayload } from "./types";
import { smartStoreProductMissing } from "./credentials";

export function assertSmartStoreProductEnv() {
  const missing = smartStoreProductMissing();
  if (missing.length > 0) {
    throw new Error(`스마트스토어 상품 등록 env 부족: ${missing.join(", ")}`);
  }
}

export function buildSmartStoreCreateBody(payload: ChannelProductPayload) {
  assertSmartStoreProductEnv();

  const leafCategoryId = process.env.SMARTSTORE_LEAF_CATEGORY_ID!.trim();
  const shippingAddressId = Number(process.env.SMARTSTORE_SHIPPING_ADDRESS_ID);
  const returnAddressId = Number(process.env.SMARTSTORE_RETURN_ADDRESS_ID);
  const deliveryAttributeType =
    process.env.SMARTSTORE_DELIVERY_ATTRIBUTE_TYPE?.trim() || "NORMAL";
  const deliveryFeeType = process.env.SMARTSTORE_DELIVERY_FEE_TYPE?.trim() || "FREE";
  const baseFee = Number(process.env.SMARTSTORE_DELIVERY_FEE ?? "0");
  const returnDeliveryFee = Number(process.env.SMARTSTORE_RETURN_DELIVERY_FEE ?? "3000");
  const exchangeDeliveryFee = Number(
    process.env.SMARTSTORE_EXCHANGE_DELIVERY_FEE ?? String(returnDeliveryFee),
  );
  const statusType = process.env.SMARTSTORE_STATUS_TYPE?.trim() || "WAIT";
  const images = payload.images.filter(Boolean);
  const representative = images[0] || "https://via.placeholder.com/1000";

  return {
    originProduct: {
      statusType,
      saleType: "NEW",
      leafCategoryId,
      name: payload.title.slice(0, 100),
      detailContent: payload.detailHtml || `<p>${payload.noticeText}</p>`,
      images: {
        representativeImage: { url: representative },
        optionalImages: images.slice(1, 10).map((url) => ({ url })),
      },
      salePrice: payload.salePriceKrw,
      stockQuantity: payload.inStock
        ? Number(process.env.SMARTSTORE_DEFAULT_STOCK ?? "999")
        : 0,
      deliveryInfo: {
        deliveryType: "DELIVERY",
        deliveryAttributeType,
        deliveryCompany: process.env.SMARTSTORE_DELIVERY_COMPANY?.trim() || undefined,
        deliveryBundleGroupUsable: false,
        deliveryFee: {
          deliveryFeeType,
          baseFee,
          deliveryFeePayType:
            process.env.SMARTSTORE_DELIVERY_FEE_PAY_TYPE?.trim() || "PREPAID",
        },
        claimDeliveryInfo: {
          returnDeliveryCompanyPriorityType: "PRIMARY",
          returnDeliveryFee,
          exchangeDeliveryFee,
          shippingAddressId,
          returnAddressId,
        },
      },
      detailAttribute: {
        naverShoppingSearchInfo: {
          manufacturerName: "구매대행",
          brandName: "해외직구",
          modelName: payload.externalId,
        },
        afterServiceInfo: {
          afterServiceTelephoneNumber:
            process.env.SMARTSTORE_AS_PHONE?.trim() || "0000-0000",
          afterServiceGuideContent:
            process.env.SMARTSTORE_AS_GUIDE?.trim() ||
            "구매대행 상품으로 A/S는 판매자에게 문의해 주세요.",
        },
        originAreaInfo: {
          originAreaCode: process.env.SMARTSTORE_ORIGIN_AREA_CODE?.trim() || "0200037",
          content: process.env.SMARTSTORE_ORIGIN_CONTENT?.trim() || "미국",
        },
        productInfoProvidedNotice: {
          productInfoProvidedNoticeType: "ETC",
          etc: {
            returnCostReason: "상세페이지 참조",
            noRefundReason: "상세페이지 참조",
            qualityAssuranceStandard: "상세페이지 참조",
            compensationProcedure: "상세페이지 참조",
            troubleShootingContents: payload.noticeText || "상세페이지 참조",
          },
        },
      },
    },
    smartstoreChannelProduct: {
      channelProductName: payload.title.slice(0, 100),
      naverShoppingRegistration: true,
      channelProductDisplayStatusType: "WAIT",
    },
  };
}

export function extractSmartStoreIds(body: unknown): {
  originProductNo?: string;
  channelProductNo?: string;
} {
  if (!body || typeof body !== "object") return {};
  const row = body as Record<string, unknown>;
  const origin =
    row.originProductNo ??
    (row.originProduct as { originProductNo?: unknown } | undefined)?.originProductNo;
  const channel =
    row.smartstoreChannelProductNo ??
    row.channelProductNo ??
    (row.smartstoreChannelProduct as { channelProductNo?: unknown } | undefined)
      ?.channelProductNo;

  return {
    originProductNo: origin != null ? String(origin) : undefined,
    channelProductNo: channel != null ? String(channel) : undefined,
  };
}
