import { NextResponse } from "next/server";
import { getRazorpayClient } from "@/lib/razorpay/client";
import { getRazorpayServerConfig } from "@/lib/razorpay/env";
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

    // Verify user is admin of workspace
    const { data: membership } = await supabase
      .from("workspace_memberships")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .single();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { data: subscription } = await supabase
      .from("workspace_subscriptions")
      .select("razorpay_subscription_id")
      .eq("workspace_id", workspaceId)
      .single();

    if (!subscription || !subscription.razorpay_subscription_id) {
      return NextResponse.json({ error: "No active subscription" }, { status: 400 });
    }

    // Cancel at period end
    await getRazorpayClient().subscriptions.cancel(subscription.razorpay_subscription_id, false);

    // We'll let the webhook update the DB, or we can eagerly update it here
    await supabase
      .from("workspace_subscriptions")
      .update({ cancel_at_period_end: true })
      .eq("workspace_id", workspaceId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cancel error:", error);
    return NextResponse.json({ error: "Failed to cancel subscription" }, { status: 500 });
  }
}