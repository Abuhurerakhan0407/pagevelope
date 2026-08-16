import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { decryptIntegrationSecret, encryptIntegrationSecret } from "@/lib/integrations/crypto";
import { normalizeShopDomain, requireShopifyServerConfig } from "@/lib/shopify/config";
import { exchangeShopifyAuthorizationCode, verifyShopifyOAuthHmac } from "@/lib/shopify/oauth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "pagevelope_shopify_oauth";

type OAuthCookie = {
  workspaceId: string;
  brandId: string;
  shop: string;
  userId: string;
  state: string;
  createdAt: number;
};

function brandUrl(workspaceId: string, brandId: string, suffix: string) {
  return `/workspaces/${encodeURIComponent(workspaceId)}/brands/${encodeURIComponent(brandId)}?shopify=${suffix}`;
}

export async function GET(request: Request) {
  let config;
  try {
    config = requireShopifyServerConfig();
  } catch {
    return NextResponse.json({ error: "Shopify OAuth is not configured in this environment." }, { status: 503 });
  }

  const url = new URL(request.url);
  if (!verifyShopifyOAuthHmac(url, config.clientSecret)) {
    return NextResponse.json({ error: "Shopify callback HMAC verification failed." }, { status: 400 });
  }

  const code = url.searchParams.get("code")?.trim() ?? "";
  const returnedState = url.searchParams.get("state")?.trim() ?? "";
  const shop = normalizeShopDomain(url.searchParams.get("shop") ?? "");
  if (!code || !returnedState || !shop) return NextResponse.json({ error: "Invalid Shopify OAuth callback." }, { status: 400 });

  const cookieStore = await cookies();
  const sealed = cookieStore.get(COOKIE_NAME)?.value;
  if (!sealed) return NextResponse.json({ error: "Shopify OAuth session expired." }, { status: 400 });

  let oauth: OAuthCookie;
  try {
    oauth = JSON.parse(decryptIntegrationSecret(sealed, config.tokenEncryptionKey)) as OAuthCookie;
  } catch {
    return NextResponse.json({ error: "Shopify OAuth session could not be verified." }, { status: 400 });
  }

  if (
    !oauth.workspaceId || !oauth.brandId || !oauth.userId || !oauth.state ||
    oauth.shop !== shop || oauth.state !== returnedState || Date.now() - oauth.createdAt > 10 * 60 * 1000
  ) {
    return NextResponse.json({ error: "Shopify OAuth state expired or mismatched." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || claimsData?.claims?.sub !== oauth.userId) {
    return NextResponse.json({ error: "The signed-in user does not match the Shopify OAuth initiator." }, { status: 401 });
  }

  const [{ data: membership }, { data: brand }] = await Promise.all([
    supabase.from("workspace_memberships").select("role").eq("workspace_id", oauth.workspaceId).eq("user_id", oauth.userId).maybeSingle(),
    supabase.from("brands").select("id").eq("workspace_id", oauth.workspaceId).eq("id", oauth.brandId).maybeSingle(),
  ]);
  if (!membership || !["owner", "admin"].includes(membership.role) || !brand) {
    return NextResponse.json({ error: "Workspace authorization changed before Shopify connection completed." }, { status: 403 });
  }

  let token;
  try {
    token = await exchangeShopifyAuthorizationCode(shop, config, code);
  } catch {
    return NextResponse.redirect(new URL(brandUrl(oauth.workspaceId, oauth.brandId, "token-error"), url));
  }

  const admin = createAdminClient(config.supabaseServiceRoleKey);
  const scopes = token.scope.split(",").map((value) => value.trim()).filter(Boolean);
  if (!scopes.includes("read_products")) {
    return NextResponse.redirect(new URL(brandUrl(oauth.workspaceId, oauth.brandId, "scope-error"), url));
  }

  const { data: connection, error: connectionError } = await admin
    .from("integration_connections")
    .upsert({
      workspace_id: oauth.workspaceId,
      provider: "shopify",
      status: "connected",
      external_account_id: shop,
      external_account_name: shop,
      scopes,
      connected_by: oauth.userId,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "workspace_id,provider" })
    .select("id")
    .single();

  if (connectionError || !connection?.id) {
    return NextResponse.json({ error: "Shopify connection metadata could not be stored." }, { status: 500 });
  }

  const { error: credentialError } = await admin
    .from("integration_credentials_secure")
    .upsert({
      connection_id: connection.id,
      access_token_ciphertext: encryptIntegrationSecret(token.access_token, config.tokenEncryptionKey),
      refresh_token_ciphertext: null,
      access_expires_at: null,
      token_type: "bearer",
      updated_at: new Date().toISOString(),
    }, { onConflict: "connection_id" });

  if (credentialError) {
    await admin.from("integration_connections").update({ status: "reauthorization_required" }).eq("id", connection.id);
    return NextResponse.json({ error: "Encrypted Shopify credential could not be stored." }, { status: 500 });
  }

  const response = NextResponse.redirect(new URL(brandUrl(oauth.workspaceId, oauth.brandId, "connected"), url));
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/integrations/shopify",
    maxAge: 0,
  });
  return response;
}
