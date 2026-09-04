import { createClient } from "@/lib/supabase/server";

type PaidTier = "starter" | "pro" | "agency";

export type Feature = "advanced_editor" | "analytics" | "unlimited_campaigns";

const PAID_TIERS: PaidTier[] = ["starter", "pro", "agency"];

export type WorkspaceSubscriptionState = {
  tier?: string | null;
  status?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
};

export function hasPaidWorkspaceAccess(subscription: WorkspaceSubscriptionState | null | undefined, now = Date.now()) {
  if (!subscription || !PAID_TIERS.includes(subscription.tier as PaidTier)) return false;
  const periodEnd = subscription.current_period_end ? Date.parse(subscription.current_period_end) : null;
  if (periodEnd !== null && (!Number.isFinite(periodEnd) || periodEnd <= now)) return false;
  if (subscription.status === "active") return true;
  return subscription.status === "canceled" && Boolean(subscription.cancel_at_period_end) && periodEnd !== null;
}

export async function checkFeatureEntitlement(workspaceId: string, feature: Feature) {
  const supabase = await createClient();

  const { data: subscription } = await supabase
    .from("workspace_subscriptions")
    .select("tier,status,current_period_end,cancel_at_period_end")
    .eq("workspace_id", workspaceId)
    .single();

  void feature;
  return hasPaidWorkspaceAccess(subscription);
}
