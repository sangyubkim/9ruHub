import bcrypt from "bcryptjs";
import { ChannelApiError, errorMessageFromBody, readJsonSafe } from "./http";

const TOKEN_URL = "https://api.commerce.naver.com/external/v1/oauth2/token";

type TokenCache = {
  accessToken: string;
  expiresAt: number;
};

let tokenCache: TokenCache | null = null;

export function generateSmartStoreSignature(
  clientId: string,
  clientSecret: string,
  timestamp: number,
): string {
  const password = `${clientId}_${timestamp}`;
  const hashed = bcrypt.hashSync(password, clientSecret);
  return Buffer.from(hashed, "utf-8").toString("base64");
}

export function clearSmartStoreTokenCache() {
  tokenCache = null;
}

export async function fetchSmartStoreAccessToken(
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const clientId = process.env.SMARTSTORE_CLIENT_ID?.trim();
  const clientSecret = process.env.SMARTSTORE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("SMARTSTORE_CLIENT_ID / SMARTSTORE_CLIENT_SECRET 이 필요합니다.");
  }

  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 60_000) {
    return tokenCache.accessToken;
  }

  const timestamp = now;
  const clientSecretSign = generateSmartStoreSignature(clientId, clientSecret, timestamp);
  const tokenType = (process.env.SMARTSTORE_TOKEN_TYPE?.trim() || "SELF").toUpperCase();

  const body = new URLSearchParams({
    client_id: clientId,
    timestamp: String(timestamp),
    client_secret_sign: clientSecretSign,
    grant_type: "client_credentials",
    type: tokenType,
  });

  if (tokenType === "SELLER") {
    const accountId = process.env.SMARTSTORE_ACCOUNT_ID?.trim();
    if (!accountId) {
      throw new Error("SMARTSTORE_TOKEN_TYPE=SELLER 일 때 SMARTSTORE_ACCOUNT_ID 가 필요합니다.");
    }
    body.set("account_id", accountId);
  }

  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await readJsonSafe(res)) as {
    access_token?: string;
    expires_in?: number;
  } | null;

  if (!res.ok || !json?.access_token) {
    throw new ChannelApiError(
      errorMessageFromBody(json, "스마트스토어 토큰 발급 실패"),
      res.status,
      json,
    );
  }

  const expiresInSec = Number(json.expires_in ?? 10_800);
  tokenCache = {
    accessToken: json.access_token,
    expiresAt: now + expiresInSec * 1000,
  };
  return json.access_token;
}
