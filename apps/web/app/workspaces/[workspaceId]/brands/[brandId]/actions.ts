"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabasePublicConfig } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function createCampaignDraft(workspaceId: string, brandId: string, formData: FormData) {
  if (!getSupabasePublicConfig()) {
    redirect("/dashboard");
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > 200) {
    redirect(`/workspaces/${workspaceId}/brands/${brandId}?error=invalid-campaign`);
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) {
    redirect("/auth/sign-in");
  }

  const { data, error } = await supabase.rpc("create_campaign_draft", {
    target_workspace_id: workspaceId,
    target_brand_id: brandId,
    campaign_name: name,
  });

  if (error || !data) {
    redirect(`/workspaces/${workspaceId}/brands/${brandId}?error=campaign-create-failed`);
  }

  revalidatePath(`/workspaces/${workspaceId}/brands/${brandId}`);
  redirect(`/builder?workspaceId=${encodeURIComponent(workspaceId)}&brandId=${encodeURIComponent(brandId)}&campaignId=${encodeURIComponent(String(data))}`);
}
