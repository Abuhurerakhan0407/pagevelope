import { NextResponse } from "next/server";
import { getRazorpayClient } from "@/lib/razorpay/client";
import { getRazorpayServerConfig } from "@/lib/razorpay/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    if (!getRazorpayServerConfig()) {
      return NextResponse.json(
        { error: "Billing is not configured yet. Cancellation is unavailable until Razorpay credentials are provided." },
        { status: 503 },
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { workspaceId } = await req.json();

    if (!workspaceId) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!serviceRoleKey) {
      return NextResponse.json({ error: "Billing administration is not configured." }, { status: 503 });
    }

    // Verify user is admin of workspace
    const { data: membership, error: membershipError } = await supabase
      .from("workspace_memberships")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .single();

    if (membershipError || !membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { data: subscription, error: subscriptionError } = await supabase
      .from("workspace_subscriptions")
      .select("razorpay_subscription_id")
      .eq("workspace_id", workspaceId)
      .single();

    if (subscriptionError || !subscription || !subscription.razorpay_subscription_id) {
      return NextResponse.json({ error: "No active subscription" }, { status: 400 });
    }

    // Cancel at period end
    await getRazorpayClient().subscriptions.cancel(subscription.razorpay_subscription_id, true);

    const admin = createAdminClient(serviceRoleKey);
    const { error: updateError } = await admin
      .from("workspace_subscriptions")
      .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
      .eq("workspace_id", workspaceId);
    if (updateError) throw updateError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cancel error:", error);
    return NextResponse.json({ error: "Failed to cancel subscription" }, { status: 500 });
  }
}
