"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabasePublicConfig } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const systems = new Set([
  "product-launch",
  "collection-editorial",
  "restock-waitlist",
  "limited-offer",
  "lifecycle-reminder",
]);
const motionLevels = new Set(["none", "subtle", "expressive"]);
const directionKeys = new Set(["editorial", "product", "motion"]);

function briefPath(workspaceId: string, brandId: string, campaignId: string) {
  return `/workspaces/${workspaceId}/brands/${brandId}/campaigns/${campaignId}/brief`;
}

export async function saveCampaignBrief(
  workspaceId: string,
  brandId: string,
  campaignId: string,
  formData: FormData,
) {
  if (!getSupabasePublicConfig()) redirect("/dashboard");

  const campaignSystem = String(formData.get("campaignSystem") ?? "").trim();
  const goal = String(formData.get("goal") ?? "").trim();
  const audience = String(formData.get("audience") ?? "").trim();
  const offer = String(formData.get("offer") ?? "").trim();
  const tone = String(formData.get("tone") ?? "").trim();
  const motionLevel = String(formData.get("motionLevel") ?? "").trim();
  const path = briefPath(workspaceId, brandId, campaignId);

  if (
    !systems.has(campaignSystem) ||
    goal.length < 3 || goal.length > 600 ||
    audience.length < 2 || audience.length > 300 ||
    offer.length < 1 || offer.length > 300 ||
    tone.length < 2 || tone.length > 120 ||
    !motionLevels.has(motionLevel)
  ) {
    redirect(`${path}?error=invalid-brief&edit=1`);
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) redirect("/auth/sign-in");

  const { error } = await supabase.rpc("save_campaign_brief", {
    target_workspace_id: workspaceId,
    target_campaign_id: campaignId,
    requested_system: campaignSystem,
    requested_goal: goal,
    requested_audience: audience,
    requested_offer: offer,
    requested_tone: tone,
    requested_motion_level: motionLevel,
  });

  if (error) redirect(`${path}?error=brief-save-failed&edit=1`);

  revalidatePath(path);
  revalidatePath(`/workspaces/${workspaceId}/brands/${brandId}`);
  redirect(`${path}?brief=1`);
}

export async function selectCreativeDirection(
  workspaceId: string,
  brandId: string,
  campaignId: string,
  formData: FormData,
) {
  if (!getSupabasePublicConfig()) redirect("/dashboard");

  const directionKey = String(formData.get("directionKey") ?? "").trim();
  const path = briefPath(workspaceId, brandId, campaignId);
  if (!directionKeys.has(directionKey)) redirect(`${path}?error=invalid-direction`);

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) redirect("/auth/sign-in");

  const { error } = await supabase.rpc("select_campaign_direction", {
    target_workspace_id: workspaceId,
    target_campaign_id: campaignId,
    direction_key: directionKey,
  });

  if (error) redirect(`${path}?error=direction-save-failed`);

  revalidatePath(path);
  revalidatePath(`/workspaces/${workspaceId}/brands/${brandId}`);
  redirect(
    `/builder?workspaceId=${encodeURIComponent(workspaceId)}&brandId=${encodeURIComponent(brandId)}&campaignId=${encodeURIComponent(campaignId)}`,
  );
}
