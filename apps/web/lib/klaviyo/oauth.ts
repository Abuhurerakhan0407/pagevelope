import { createHash, randomBytes } from "node:crypto";
import {
  KLAVIYO_AUTHORIZE_URL,
  KLAVIYO_OAUTH_SCOPES,
  KLAVIYO_TOKEN_URL,
  type KlaviyoServerConfig,
} from "./config";

export type KlaviyoTokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
};

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier, "utf8").digest("base64url");
  return { verifier, challenge };
}

export function createOAuthState(): string {
  return randomBytes(32).toString("base64url");
}

export function buildKlaviyoAuthorizeUrl(
  config: KlaviyoServerConfig,
  input: { state: string; challenge: string },
): string {
  const url = new URL(KLAVIYO_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", KLAVIYO_OAUTH_SCOPES.join(" "));
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", input.challenge);
  return url.toString();
}

async function tokenRequest(
  config: KlaviyoServerConfig,
  body: URLSearchParams,
): Promise<KlaviyoTokenResponse> {
  const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`, "utf8").toString("base64");
  const response = await fetch(KLAVIYO_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as Partial<KlaviyoTokenResponse> | null;
  if (!response.ok || !payload?.access_token || !payload.refresh_token || !payload.expires_in) {
    throw new Error(`Klaviyo OAuth token exchange failed with HTTP ${response.status}.`);
  }
  return payload as KlaviyoTokenResponse;
}

export function exchangeAuthorizationCode(
  config: KlaviyoServerConfig,
  input: { code: string; verifier: string },
): Promise<KlaviyoTokenResponse> {
  return tokenRequest(config, new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    code_verifier: input.verifier,
    redirect_uri: config.redirectUri,
  }));
}

export function refreshKlaviyoToken(
  config: KlaviyoServerConfig,
  refreshToken: string,
): Promise<KlaviyoTokenResponse> {
  return tokenRequest(config, new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  }));
}
