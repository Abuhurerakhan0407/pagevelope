"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabasePublicConfig } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

function productsPath(workspaceId: string, brandId: string, campaignId: string) {
  return `/workspaces/${workspaceId}/brands/${brandId}/campaigns/${campaignId}/products`;
}

export async function createManualProduct(
  workspaceId: string,
  brandId: string,
  campaignId: string,
  formData: FormData,
) {
  if (!getSupabasePublicConfig()) redirect("/dashboard");

  const path = productsPath(workspaceId, brandId, campaignId);
  const title = String(formData.get("title") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const rawPrice = String(formData.get("price") ?? "").trim();
  const currency = String(formData.get("currency") ?? "INR").trim().toUpperCase();
  const imageUrl = String(formData.get("imageUrl") ?? "").trim();
  const productUrl = String(formData.get("productUrl") ?? "").trim();
  const price = Number(rawPrice);

  if (
    !title || title.length > 200 ||
    sku.length > 120 ||
    !Number.isFinite(price) || price < 0 ||
    !/^[A-Z]{3}$/.test(currency) ||
    (imageUrl && !imageUrl.startsWith("https://")) ||
    (productUrl && !productUrl.startsWith("https://"))
  ) {
    redirect(`${path}?error=invalid-product`);
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) redirect("/auth/sign-in");

  const { error } = await supabase.rpc("create_manual_product", {
    target_workspace_id: workspaceId,
    target_brand_id: brandId,
    product_title: title,
    product_sku: sku,
    product_price: price,
    product_currency: currency,
    product_image_url: imageUrl,
    product_url: productUrl,
  });

  if (error) redirect(`${path}?error=product-create-failed`);

  revalidatePath(path);
  redirect(`${path}?product=1`);
}

export async function saveCampaignProducts(
  workspaceId: string,
  brandId: string,
  campaignId: string,
  formData: FormData,
) {
  if (!getSupabasePublicConfig()) redirect("/dashboard");

  const path = productsPath(workspaceId, brandId, campaignId);
  const productIds = formData
    .getAll("productIds")
    .map((value) => String(value).trim())
    .filter(Boolean);
  const uniqueIds = [...new Set(productIds)];

  if (uniqueIds.length < 1 || uniqueIds.length > 6 || uniqueIds.length !== productIds.length) {
    redirect(`${path}?error=invalid-selection`);
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) redirect("/auth/sign-in");

  const { error } = await supabase.rpc("set_campaign_products", {
    target_workspace_id: workspaceId,
    target_campaign_id: campaignId,
    product_ids: uniqueIds,
  });

  if (error) redirect(`${path}?error=selection-save-failed`);

  revalidatePath(path);
  revalidatePath(`/workspaces/${workspaceId}/brands/${brandId}`);
  redirect(
    `/workspaces/${encodeURIComponent(workspaceId)}/brands/${encodeURIComponent(brandId)}/campaigns/${encodeURIComponent(campaignId)}/brief`,
  );
}
