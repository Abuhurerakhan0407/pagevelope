"use server";
import { trackServerEvent } from "@/lib/analytics/server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabasePublicConfig } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const HEX = /^#[0-9a-fA-F]{6}$/;

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function readOptional(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

export async function createBrand(workspaceId: string, formData: FormData) {
  if (!getSupabasePublicConfig()) {
    redirect(`/workspaces/${workspaceId}/brands/new?error=supabase-not-configured`);
  }

  const name = String(formData.get("name") ?? "").trim();
  const slug = normalizeSlug(String(formData.get("slug") ?? name));
  const primaryColor = String(formData.get("primaryColor") ?? "#6F5CFB").trim();
  const accentColor = String(formData.get("accentColor") ?? "#A78BFA").trim();
  const backgroundColor = String(formData.get("backgroundColor") ?? "#FFFFFF").trim();
  const textColor = String(formData.get("textColor") ?? "#0F1221").trim();
  const fontFamily = String(formData.get("fontFamily") ?? "Inter").trim();
  const websiteUrl = readOptional(formData, "websiteUrl");
  const companyName = readOptional(formData, "companyName");
  const legalAddress = readOptional(formData, "legalAddress");

  const colors = [primaryColor, accentColor, backgroundColor, textColor];
  const invalid =
    !name || name.length > 160 || !slug || colors.some((color) => !HEX.test(color)) ||
    !fontFamily || fontFamily.length > 80 ||
    Boolean(websiteUrl && !websiteUrl.startsWith("https://")) ||
    Boolean(companyName && companyName.length > 160) ||
    Boolean(legalAddress && (legalAddress.length < 5 || legalAddress.length > 500));

  if (invalid) {
    redirect(`/workspaces/${workspaceId}/brands/new?error=invalid-brand`);
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    redirect("/auth/sign-in");
  }

  const { data, error } = await supabase.rpc("create_brand_profile", {
    target_workspace_id: workspaceId,
    brand_name: name,
    brand_slug: slug,
    brand_primary_color: primaryColor,
    brand_accent_color: accentColor,
    brand_background_color: backgroundColor,
    brand_text_color: textColor,
    brand_font_family: fontFamily,
    brand_website_url: websiteUrl,
    brand_company_name: companyName,
    brand_legal_address: legalAddress,
  });

  if (error || !data) {
    redirect(`/workspaces/${workspaceId}/brands/new?error=brand-create-failed`);
  }

  await trackServerEvent("brand_created", { workspaceId, properties: { brandId: data } });
  revalidatePath("/dashboard");
  redirect(`/workspaces/${workspaceId}/brands/${String(data)}?created=1`);
}
