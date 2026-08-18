import { createClient } from "@/lib/supabase/server";

type PaidTier = "starter" | "pro" | "agency";

export type Feature = "advanced_editor" | "analytics" | "unlimited_campaigns";

const PAID_TIERS: PaidTier[] = ["starter", "pro", "agency"];

export async function checkFeatureEntitlement(workspaceId: string, feature: Feature) {
  const supabase = await createClient();

  const { data: subscription } = await supabase
    .from("workspace_subscriptions")
    .select("tier, status")
    .eq("workspace_id", workspaceId)
    .single();

  const tier = subscription?.tier as PaidTier | "free" | null | undefined;
  const isActive = subscription?.status === "active";

  // Free tier rules
  if (tier === "free" || !tier || !isActive) {
    if (feature === "advanced_editor") return false;
    if (feature === "analytics") return false;
    if (feature === "unlimited_campaigns") {
      // Check current usage
      const { count } = await supabase
        .from("campaigns")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspaceId);

      return (count || 0) < 3; // Max 3 campaigns on free tier
    }
  }

  // Paid tier rules
  if (PAID_TIERS.includes(tier as PaidTier) && isActive) {
    return true; // Paid tiers have all features
  }

  return false;
}