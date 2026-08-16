import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getKlaviyoAccount } from "@/lib/klaviyo/client";
import { requireKlaviyoServerConfig } from "@/lib/klaviyo/config";
import { decryptKlaviyoToken, encryptKlaviyoToken } from "@/lib/klaviyo/crypto";
import { exchangeAuthorizationCode } from "@/lib/klaviyo/oauth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "pagevelope_klaviyo_oauth";

type OAuthCookie = {
  workspaceId: string;
  userId: string;
  state: string;
  verifier: string;
  createdAt: number;
};

function equalState(expected: string, actual: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(actual, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  let config;
  try {
    config = requireKlaviyoServerConfig();
  } catch {
    return NextResponse.json({ error: "Klaviyo OAuth is not configured in this environment." }, { status: 503 });
  }

  const url = new URL(request.url);
  const providerError = url.searchParams.get("error");
  if (providerError) return NextResponse.redirect(new URL(`/dashboard?klaviyo=error&reason=${encodeURIComponent(providerError)}`, url));

  const code = url.searchParams.get("code")?.trim();
  const returnedState = url.searchParams.get("state")?.trim();
  if (!code || !returnedState) return NextResponse.json({ error: "Missing OAuth code or state." }, { status: 400 });

  const cookieStore = await cookies();
  const sealed = cookieStore.get(COOKIE_NAME)?.value;
  if (!sealed) return NextResponse.json({ error: "OAuth session expired. Start the connection again." }, { status: 400 });

  let oauth: OAuthCookie;
  try {
    oauth = JSON.parse(decryptKlaviyoToken(sealed, config.tokenEncryptionKey)) as OAuthCookie;
  } catch {
    return NextResponse.json({ error: "OAuth session could not be verified." }, { status: 400 });
  }

  if (!oauth.workspaceId || !oauth.userId || !oauth.state || !oauth.verifier || Date.now() - oauth.createdAt > 10 * 60 * 1000) {
    return NextResponse.json({ error: "OAuth session expired or is invalid." }, { status: 400 });
  }
  if (!equalState(oauth.state, returnedState)) return NextResponse.json({ error: "OAuth state mismatch." }, { status: 400 });

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || claimsData?.claims?.sub !== oauth.userId) {
    return NextResponse.json({ error: "The signed-in user does not match the OAuth initiator." }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("workspace_memberships")
    .select("role")
    .eq("workspace_id", oauth.workspaceId)
    .eq("user_id", oauth.userId)
    .maybeSingle();
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Workspace owner or admin access is required to connect Klaviyo." }, { status: 403 });
  }

  let tokens;
  let account;
  try {
    tokens = await exchangeAuthorizationCode(config, { code, verifier: oauth.verifier });
    account = await getKlaviyoAccount(tokens.access_token);
  } catch {
    return NextResponse.redirect(new URL("/dashboard?klaviyo=token-error", url));
  }

  const admin = createAdminClient(config.supabaseServiceRoleKey);
  const scopes = tokens.scope.split(/\s+/).map((value) => value.trim()).filter(Boolean);
  const { data: connection, error: connectionError } = await admin
    .from("integration_connections")
    .upsert({
      workspace_id: oauth.workspaceId,
      provider: "klaviyo",
      status: "connected",
      external_account_id: account.accountId,
      external_account_name: account.name ?? null,
      scopes,
      connected_by: oauth.userId,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "workspace_id,provider" })
    .select("id")
    .single();

  if (connectionError || !connection?.id) {
    return NextResponse.json({ error: "Klaviyo connection metadata could not be stored." }, { status: 500 });
  }

  const accessExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  const { error: credentialsError } = await admin
    .from("integration_credentials_secure")
    .upsert({
      connection_id: connection.id,
      access_token_ciphertext: encryptKlaviyoToken(tokens.access_token, config.tokenEncryptionKey),
      refresh_token_ciphertext: encryptKlaviyoToken(tokens.refresh_token, config.tokenEncryptionKey),
      access_expires_at: accessExpiresAt,
      token_type: tokens.token_type.toLowerCase(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "connection_id" });

  if (credentialsError) {
    await admin.from("integration_connections").update({ status: "reauthorization_required" }).eq("id", connection.id);
    return NextResponse.json({ error: "Encrypted Klaviyo credentials could not be stored." }, { status: 500 });
  }

  const response = NextResponse.redirect(new URL("/dashboard?klaviyo=connected", url));
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/integrations/klaviyo",
    maxAge: 0,
  });
  return response;
}
