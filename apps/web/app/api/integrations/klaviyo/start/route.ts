import { NextResponse } from "next/server";
import { encryptKlaviyoToken } from "@/lib/klaviyo/crypto";
import { requireKlaviyoServerConfig } from "@/lib/klaviyo/config";
import { buildKlaviyoAuthorizeUrl, createOAuthState, createPkcePair } from "@/lib/klaviyo/oauth";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "pagevelope_klaviyo_oauth";

export async function GET(request: Request) {
  let config;
  try {
    config = requireKlaviyoServerConfig();
  } catch {
    return NextResponse.json({ error: "Klaviyo OAuth is not configured in this environment." }, { status: 503 });
  }

  const workspaceId = new URL(request.url).searchParams.get("workspaceId")?.trim();
  if (!workspaceId) return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_memberships")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipError || !membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Workspace owner or admin access is required to connect Klaviyo." }, { status: 403 });
  }

  const state = createOAuthState();
  const { verifier, challenge } = createPkcePair();
  const cookiePayload = JSON.stringify({ workspaceId, userId, state, verifier, createdAt: Date.now() });
  const sealed = encryptKlaviyoToken(cookiePayload, config.tokenEncryptionKey);
  const authorizeUrl = buildKlaviyoAuthorizeUrl(config, { state, challenge });

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(COOKIE_NAME, sealed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/integrations/klaviyo",
    maxAge: 10 * 60,
  });
  return response;
}
