import { NextResponse } from "next/server";
import { fetchShopifyProductPage } from "@/lib/shopify/client";
import { getWorkspaceShopifyAccess } from "@/lib/shopify/credentials";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SyncBody = {
  workspaceId?: unknown;
  brandId?: unknown;
  cursor?: unknown;
};

export async function POST(request: Request) {
  let body: SyncBody;
  try {
    body = await request.json() as SyncBody;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId.trim() : "";
  const brandId = typeof body.brandId === "string" ? body.brandId.trim() : "";
  const cursor = typeof body.cursor === "string" && body.cursor.trim() ? body.cursor.trim() : null;
  if (!workspaceId || !brandId) {
    return NextResponse.json({ error: "workspaceId and brandId are required." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const [{ data: membership }, { data: brand }] = await Promise.all([
    supabase.from("workspace_memberships").select("role").eq("workspace_id", workspaceId).eq("user_id", userId).maybeSingle(),
    supabase.from("brands").select("id").eq("workspace_id", workspaceId).eq("id", brandId).maybeSingle(),
  ]);
  if (!membership || !["owner", "admin", "editor"].includes(membership.role)) {
    return NextResponse.json({ error: "Workspace edit access is required to sync products." }, { status: 403 });
  }
  if (!brand) return NextResponse.json({ error: "Brand not found in this workspace." }, { status: 404 });

  let access;
  let page;
  try {
    access = await getWorkspaceShopifyAccess(workspaceId);
    page = await fetchShopifyProductPage(access.shop, access.accessToken, cursor, 50);
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Shopify product sync failed.",
      code: "SHOPIFY_SYNC_SOURCE_FAILED",
    }, { status: 502 });
  }

  const failures: Array<{ externalId: string; message: string }> = [];
  let synced = 0;

  for (const product of page.products) {
    const price = Number(product.price);
    const productUrl = product.onlineStoreUrl ?? `https://${access.shop}/products/${encodeURIComponent(product.handle)}`;
    const { error } = await supabase.rpc("upsert_shopify_product", {
      target_workspace_id: workspaceId,
      target_brand_id: brandId,
      shopify_product_id: product.id,
      product_title: product.title,
      product_sku: product.sku ?? "",
      product_price: Number.isFinite(price) ? price : 0,
      product_currency: page.currencyCode,
      product_image_url: product.imageUrl ?? "",
      product_url: productUrl,
      shopify_updated_at: product.updatedAt,
    });
    if (error) {
      failures.push({ externalId: product.id, message: error.message });
    } else {
      synced += 1;
    }
  }

  if (failures.length) {
    return NextResponse.json({
      error: "Some Shopify products could not be persisted.",
      code: "SHOPIFY_SYNC_PARTIAL",
      synced,
      failed: failures.length,
      failures: failures.slice(0, 10),
      nextCursor: page.endCursor,
      hasNextPage: page.hasNextPage,
    }, { status: 207, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json({
    synced,
    failed: 0,
    nextCursor: page.endCursor,
    hasNextPage: page.hasNextPage,
    currency: page.currencyCode,
  }, { headers: { "Cache-Control": "no-store" } });
}
