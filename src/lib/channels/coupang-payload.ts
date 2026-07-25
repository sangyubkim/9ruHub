import type { ChannelProductPayload } from "./types";
import { coupangProductMissing } from "./credentials";

export function assertCoupangProductEnv() {
  const missing = coupangProductMissing();
  if (missing.length > 0) {
    throw new Error(`쿠팡 상품 등록 env 부족: ${missing.join(", ")}`);
  }
}

export function buildCoupangCreateBody(payload: ChannelProductPayload) {
  assertCoupangProductEnv();

  const vendorId = process.env.COUPANG_VENDOR_ID!.trim();
  const displayCategoryCode = Number(process.env.COUPANG_DISPLAY_CATEGORY_CODE);
  const images = payload.images.filter(Boolean);
  const mainImage = images[0] || "https://via.placeholder.com/1000";
  const qty = payload.inStock
    ? String(process.env.COUPANG_DEFAULT_QUANTITY ?? "100")
    : "0";
  const returnCharge = Number(process.env.COUPANG_RETURN_CHARGE ?? "2500");
  const deliveryCharge = Number(process.env.COUPANG_DELIVERY_CHARGE ?? "0");
  const deliveryChargeType =
    process.env.COUPANG_DELIVERY_CHARGE_TYPE?.trim() || "FREE";
  const noticeCategory =
    process.env.COUPANG_NOTICE_CATEGORY?.trim() || "기타 재화";
  const requested = (process.env.COUPANG_REQUESTED ?? "false").toLowerCase() === "true";

  const now = new Date();
  const saleStartedAt = `${now.toISOString().slice(0, 10)}T00:00:00`;

  return {
    displayCategoryCode,
    sellerProductName: payload.title.slice(0, 100),
    vendorId,
    saleStartedAt,
    saleEndedAt: "2099-01-01T23:59:59",
    displayProductName: payload.title.slice(0, 100),
    brand: process.env.COUPANG_BRAND?.trim() || "구매대행",
    generalProductName: payload.title.slice(0, 30),
    productGroup: process.env.COUPANG_PRODUCT_GROUP?.trim() || "해외직구",
    deliveryMethod: process.env.COUPANG_DELIVERY_METHOD?.trim() || "SEQUENCIAL",
    deliveryCompanyCode: process.env.COUPANG_DELIVERY_COMPANY_CODE?.trim() || "KDEXP",
    deliveryChargeType,
    deliveryCharge,
    freeShipOverAmount: Number(process.env.COUPANG_FREE_SHIP_OVER_AMOUNT ?? "0"),
    deliveryChargeOnReturn: returnCharge,
    remoteAreaDeliverable: process.env.COUPANG_REMOTE_AREA?.trim() || "N",
    unionDeliveryType: process.env.COUPANG_UNION_DELIVERY?.trim() || "UNION_DELIVERY",
    returnCenterCode: process.env.COUPANG_RETURN_CENTER_CODE!.trim(),
    returnChargeName: process.env.COUPANG_RETURN_CHARGE_NAME!.trim(),
    companyContactNumber: process.env.COUPANG_COMPANY_CONTACT_NUMBER!.trim(),
    returnZipCode: process.env.COUPANG_RETURN_ZIP_CODE?.trim() || "06236",
    returnAddress: process.env.COUPANG_RETURN_ADDRESS?.trim() || "서울특별시",
    returnAddressDetail: process.env.COUPANG_RETURN_ADDRESS_DETAIL?.trim() || "상세주소",
    returnCharge,
    outboundShippingPlaceCode: process.env.COUPANG_OUTBOUND_SHIPPING_PLACE_CODE!.trim(),
    vendorUserId: process.env.COUPANG_VENDOR_USER_ID!.trim(),
    requested,
    items: [
      {
        itemName: payload.options[0]?.values[0] || "기본",
        originalPrice: payload.salePriceKrw,
        salePrice: payload.salePriceKrw,
        maximumBuyCount: qty,
        maximumBuyForPerson: "0",
        outboundShippingTimeDay: process.env.COUPANG_OUTBOUND_DAYS?.trim() || "3",
        maximumBuyForPersonPeriod: "1",
        unitCount: 1,
        adultOnly: "EVERYONE",
        taxType: "TAX",
        parallelImported: "NOT_PARALLEL_IMPORTED",
        overseasPurchased: "OVERSEAS_PURCHASED",
        pccNeeded: "true",
        externalVendorSku: payload.externalId,
        barcode: "",
        emptyBarcode: true,
        emptyBarcodeReason: "상품확인불가_바코드없음사유",
        modelNo: payload.externalId,
        certifications: [
          {
            certificationType: "NOT_REQUIRED",
            certificationCode: "",
          },
        ],
        searchTags: [payload.externalId, "구매대행"].filter(Boolean),
        images: [
          {
            imageOrder: 0,
            imageType: "REPRESENTATION",
            vendorPath: mainImage,
          },
          ...images.slice(1, 9).map((url, index) => ({
            imageOrder: index + 1,
            imageType: "DETAIL",
            vendorPath: url,
          })),
        ],
        notices: [
          {
            noticeCategoryName: noticeCategory,
            noticeCategoryDetailName: "품명 및 모델명",
            content: payload.title,
          },
          {
            noticeCategoryName: noticeCategory,
            noticeCategoryDetailName: "인증/허가 사항",
            content: "상세페이지 참조",
          },
          {
            noticeCategoryName: noticeCategory,
            noticeCategoryDetailName: "제조국 또는 원산지",
            content: "미국",
          },
          {
            noticeCategoryName: noticeCategory,
            noticeCategoryDetailName: "제조자/수입자",
            content: "상세페이지 참조",
          },
          {
            noticeCategoryName: noticeCategory,
            noticeCategoryDetailName: "소비자상담 관련 전화번호",
            content: process.env.COUPANG_COMPANY_CONTACT_NUMBER!.trim(),
          },
        ],
        contents: [
          {
            contentsType: "TEXT",
            contentDetails: [
              {
                content: payload.detailHtml || payload.noticeText,
                detailType: "TEXT",
              },
            ],
          },
        ],
        offerCondition: "NEW",
        offerDescription: "",
      },
    ],
    requiredDocuments: [
      {
        templateName: "기타",
        vendorDocumentPath: "",
      },
    ],
    extraInfoMessage: "",
    manufacture: "상세페이지 참조",
  };
}

export function extractCoupangSellerProductId(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const row = body as { data?: unknown; sellerProductId?: unknown };
  const data = row.data ?? row.sellerProductId;
  if (data == null) return undefined;
  return String(data);
}

export function extractCoupangVendorItemId(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const row = body as {
    data?: {
      items?: Array<{ vendorItemId?: unknown }>;
      vendorItemId?: unknown;
    };
    items?: Array<{ vendorItemId?: unknown }>;
  };
  const items = row.data?.items ?? row.items;
  const first = items?.[0]?.vendorItemId ?? row.data?.vendorItemId;
  return first != null ? String(first) : undefined;
}
