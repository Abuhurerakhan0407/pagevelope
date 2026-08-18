import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRazorpayServerConfig } from "@/lib/razorpay/env";
import { BillingClient } from "./billing-client";

export default async function BillingPage({
  params
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in");
  }

  const { data: membership } = await supabase
    .from("workspace_memberships")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    redirect(`/workspaces/${workspaceId}`);
  }

  const { data: subscription } = await supabase
    .from("workspace_subscriptions")
    .select("*")
    .eq("workspace_id", workspaceId)
    .single();

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Billing</h1>
      <BillingClient
        workspaceId={workspaceId}
        subscription={subscription}
        billingConfigured={Boolean(getRazorpayServerConfig())}
      />
    </div>
  );
}