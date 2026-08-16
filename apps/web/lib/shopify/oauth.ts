import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { SHOPIFY_OAUTH_SCOPES, type ShopifyServerConfig } from "./config";

export type ShopifyOfflineToken = {
  access_token: string;
  scope: string;
};

export function createShopifyState(): string {
  return randomBytes(32).toString("base64url");
}

export function buildShopifyAuthorizeUrl(
  shop: string,
  config: ShopifyServerConfig,
  state: string,
): string {
  const url = new URL(`https://${shop}/admin/oauth/authorize`);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("scope", SHOPIFY_OAUTH_SCOPES.join(","));
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

export function verifyShopifyOAuthHmac(url: URL, secret: string): boolean {
  const provided = url.searchParams.get("hmac") ?? "";
  if (!/^[0-9a-f]{64}$/i.test(provided)) return false;

  const message = [...url.searchParams.entries()]
    .filter(([key]) => key !== "hmac" && key !== "signature")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const expected = createHmac("sha256", secret).update(message, "utf8").digest("hex");
  const a = Buffer.from(provided.toLowerCase(), "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function exchangeShopifyAuthorizationCode(
  shop: string,
  config: ShopifyServerConfig,
  code: string,
): Promise<ShopifyOfflineToken> {
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
    }),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as Partial<ShopifyOfflineToken> | null;
  if (!response.ok || !payload?.access_token || !payload.scope) {
    throw new Error(`Shopify access-token exchange failed with HTTP ${response.status}.`);
  }
  return payload as ShopifyOfflineToken;
}
