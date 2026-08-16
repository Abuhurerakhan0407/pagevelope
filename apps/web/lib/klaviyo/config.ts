export const KLAVIYO_API_BASE = "https://a.klaviyo.com";
export const KLAVIYO_AUTHORIZE_URL = "https://www.klaviyo.com/oauth/authorize";
export const KLAVIYO_TOKEN_URL = "https://a.klaviyo.com/oauth/token";
export const KLAVIYO_API_REVISION = "2026-07-15";

// Least-permissive scopes for Pagevelope's approved-template publishing path.
export const KLAVIYO_OAUTH_SCOPES = [
  "accounts:read",
  "templates:read",
  "templates:write",
  "campaigns:read",
  "campaigns:write",
] as const;

export type KlaviyoServerConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokenEncryptionKey: string;
  supabaseServiceRoleKey: string;
};

export function getKlaviyoServerConfig(): KlaviyoServerConfig | null {
  const clientId = process.env.KLAVIYO_CLIENT_ID?.trim();
  const clientSecret = process.env.KLAVIYO_CLIENT_SECRET?.trim();
  const redirectUri = process.env.KLAVIYO_REDIRECT_URI?.trim();
  const tokenEncryptionKey = process.env.KLAVIYO_TOKEN_ENCRYPTION_KEY?.trim();
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!clientId || !clientSecret || !redirectUri || !tokenEncryptionKey || !supabaseServiceRoleKey) return null;
  return { clientId, clientSecret, redirectUri, tokenEncryptionKey, supabaseServiceRoleKey };
}

export function requireKlaviyoServerConfig(): KlaviyoServerConfig {
  const config = getKlaviyoServerConfig();
  if (!config) {
    throw new Error(
      "Klaviyo publishing is not configured. Server-only OAuth, token-encryption, and Supabase service-role variables are required.",
    );
  }
  return config;
}
