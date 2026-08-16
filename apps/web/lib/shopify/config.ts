export const SHOPIFY_ADMIN_API_VERSION = "2026-07";
export const SHOPIFY_OAUTH_SCOPES = ["read_products"] as const;

export type ShopifyServerConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokenEncryptionKey: string;
  supabaseServiceRoleKey: string;
};

export function getShopifyServerConfig(): ShopifyServerConfig | null {
  const clientId = process.env.SHOPIFY_CLIENT_ID?.trim();
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET?.trim();
  const redirectUri = process.env.SHOPIFY_REDIRECT_URI?.trim();
  const tokenEncryptionKey = process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY?.trim();
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!clientId || !clientSecret || !redirectUri || !tokenEncryptionKey || !supabaseServiceRoleKey) return null;
  return { clientId, clientSecret, redirectUri, tokenEncryptionKey, supabaseServiceRoleKey };
}

export function requireShopifyServerConfig(): ShopifyServerConfig {
  const config = getShopifyServerConfig();
  if (!config) throw new Error("Shopify is not configured with server-only app credentials, encryption key and Supabase service role.");
  return config;
}

export function normalizeShopDomain(input: string): string | null {
  const shop = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop) ? shop : null;
}
