import { createHmac } from "node:crypto";

/** Coupang Wing OpenAPI signed-date: yyMMddTHHmmssZ (UTC) */
export function formatCoupangSignedDate(date = new Date()): string {
  const pad = (n: number, width = 2) => String(n).padStart(width, "0");
  const yy = pad(date.getUTCFullYear() % 100);
  const MM = pad(date.getUTCMonth() + 1);
  const dd = pad(date.getUTCDate());
  const HH = pad(date.getUTCHours());
  const mm = pad(date.getUTCMinutes());
  const ss = pad(date.getUTCSeconds());
  return `${yy}${MM}${dd}T${HH}${mm}${ss}Z`;
}

/**
 * message = datetime + METHOD + path[+?query]
 * path는 /v2/... 형태, query가 있으면 ?key=value 포함
 */
export function buildCoupangMessage(
  method: string,
  pathWithQuery: string,
  signedDate: string,
): string {
  return `${signedDate}${method.toUpperCase()}${pathWithQuery}`;
}

export function createCoupangAuthorization(params: {
  method: string;
  pathWithQuery: string;
  accessKey: string;
  secretKey: string;
  signedDate?: string;
}): { authorization: string; signedDate: string } {
  const signedDate = params.signedDate ?? formatCoupangSignedDate();
  const message = buildCoupangMessage(params.method, params.pathWithQuery, signedDate);
  const signature = createHmac("sha256", params.secretKey)
    .update(message)
    .digest("hex");

  return {
    signedDate,
    authorization: `CEA algorithm=HmacSHA256, access-key=${params.accessKey}, signed-date=${signedDate}, signature=${signature}`,
  };
}
