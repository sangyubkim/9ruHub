import { createHmac, createHash } from "node:crypto";

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function sha256Hex(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

function getSignatureKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Buffer {
  const kDate = hmac(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

/**
 * AWS Signature Version 4 for PA-API 5.0 HTTPS POST.
 * @see https://docs.aws.amazon.com/general/latest/gr/signature-version-4.html
 */
export function signPaapiPostRequest(options: {
  accessKey: string;
  secretKey: string;
  host: string;
  region: string;
  path: string;
  amzTarget: string;
  payload: string;
  /** ISO8601 basic UTC e.g. 20260726T120000Z — omit to use now */
  amzDate?: string;
}): Record<string, string> {
  const service = "ProductAdvertisingAPI";
  const amzDate =
    options.amzDate ??
    new Date()
      .toISOString()
      .replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const contentType = "application/json; charset=utf-8";
  const method = "POST";

  const canonicalHeaders =
    `content-encoding:amz-1.0\n` +
    `content-type:${contentType}\n` +
    `host:${options.host}\n` +
    `x-amz-date:${amzDate}\n` +
    `x-amz-target:${options.amzTarget}\n`;

  const signedHeaders =
    "content-encoding;content-type;host;x-amz-date;x-amz-target";

  const payloadHash = sha256Hex(options.payload);
  const canonicalRequest = [
    method,
    options.path,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${options.region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = getSignatureKey(
    options.secretKey,
    dateStamp,
    options.region,
    service,
  );
  const signature = createHmac("sha256", signingKey)
    .update(stringToSign, "utf8")
    .digest("hex");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${options.accessKey}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    "content-encoding": "amz-1.0",
    "content-type": contentType,
    host: options.host,
    "x-amz-date": amzDate,
    "x-amz-target": options.amzTarget,
    authorization,
  };
}

export const __test = { sha256Hex, getSignatureKey };
