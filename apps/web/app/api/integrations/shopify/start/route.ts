import { NextResponse } from "next/server";
import { encryptIntegrationSecret } from "@/lib/integrations/crypto";
import { normalizeShopDomain, requireShopifyServerConfig } from "@/lib/shopify/config";
import { buildShopifyAuthorizeUrl, createShopifyState } from "@/lib/shopify/oauth";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "pagevelope_shopify_oauth";

export async function GET(request: Request) {
  let config;
  try {
    config = requireShopifyServerConfig();
  } catch {
    return NextResponse.json({ error: "Shopify OAuth is not configured in this environment." }, { status: 503 });
  }

  const url = new URL(request.url);
  const workspaceId = url.searchParams.get("workspaceId")?.trim() ?? "";
  const brandId = url.searchParams.get("brandId")?.trim() ?? "";
  const shop = normalizeShopDomain(url.searchParams.get("shop") ?? "");
  if (!workspaceId || !brandId || !shop) {
    return NextResponse.json({ error: "workspaceId, brandId and a valid *.myshopify.com shop are required." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const [{ data: membership }, { data: brand }] = await Promise.all([
    supabase.from("workspace_memberships").select("role").eq("workspace_id", workspaceId).eq("user_id", userId).maybeSingle(),
    supabase.from("brands").select("id").eq("workspace_id", workspaceId).eq("id", brandId).maybeSingle(),
  ]);
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Workspace owner or admin access is required to connect Shopify." }, { status: 403 });
  }
  if (!brand) return NextResponse.json({ error: "Brand not found in this workspace." }, { status: 404 });

  const state = createShopifyState();
  const sealed = encryptIntegrationSecret(
    JSON.stringify({ workspaceId, brandId, shop, userId, state, createdAt: Date.now() }),
    config.tokenEncryptionKey,
  );

  const response = NextResponse.redirect(buildShopifyAuthorizeUrl(shop, config, state));
  response.cookies.set(COOKIE_NAME, sealed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/integrations/shopify",
    maxAge: 10 * 60,
  });
  return response;
}
