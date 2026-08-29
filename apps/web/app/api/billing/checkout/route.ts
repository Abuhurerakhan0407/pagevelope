import { NextResponse } from "next/server";
import { getRazorpayClient } from "@/lib/razorpay/client";
import { getPlan, isPlanCheckoutReady } from "@/lib/razorpay/config";
import { getRazorpayServerConfig, isBillingLaunchEnabled } from "@/lib/razorpay/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    if (!isBillingLaunchEnabled() || !getRazorpayServerConfig()) {
      return NextResponse.json(
        { error: "Billing is not configured yet. Checkout is unavailable until Razorpay credentials are provided." },
        { status: 503 },
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { workspaceId, planId } = await req.json();

    if (!workspaceId || typeof planId !== "string") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!serviceRoleKey) {
      return NextResponse.json({ error: "Billing administration is not configured." }, { status: 503 });
    }

    const plan = getPlan(planId);

    if (!plan) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    if (!isPlanCheckoutReady(plan)) {
      return NextResponse.json(
        { error: `The ${plan.name} plan is not configured for checkout yet.` },
        { status: 503 },
      );
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

    const { data: existing, error: existingError } = await supabase
      .from("workspace_subscriptions")
      .select("razorpay_subscription_id, tier, status")
      .eq("workspace_id", workspaceId)
      .single();
    if (existingError) throw existingError;

    if (existing.razorpay_subscription_id && existing.status === "incomplete" && existing.tier === plan.tier) {
      return NextResponse.json({ subscriptionId: existing.razorpay_subscription_id });
    }
    if (existing.razorpay_subscription_id && !["canceled", "incomplete_expired"].includes(existing.status)) {
      return NextResponse.json({ error: "This workspace already has a subscription." }, { status: 409 });
    }

    const admin = createAdminClient(serviceRoleKey);
    const staleBefore = new Date(Date.now() - 5 * 60_000).toISOString();
    const { error: staleLockError } = await admin
      .from("billing_checkout_locks")
      .delete()
      .eq("workspace_id", workspaceId)
      .lt("started_at", staleBefore);
    if (staleLockError) throw staleLockError;

    const { error: lockError } = await admin.from("billing_checkout_locks").insert({ workspace_id: workspaceId });
    if (lockError?.code === "23505") {
      return NextResponse.json({ error: "Checkout is already being created for this workspace." }, { status: 409 });
    }
    if (lockError) throw lockError;

    try {
      const subscription = await getRazorpayClient().subscriptions.create({
        plan_id: plan.razorpayPlanId as string,
        total_count: 120,
        customer_notify: 1,
        notes: {
          workspace_id: workspaceId,
          plan: plan.id,
        },
      });

      const { error: updateError } = await admin
        .from("workspace_subscriptions")
        .update({
          razorpay_subscription_id: subscription.id,
          tier: plan.tier,
          status: "incomplete",
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        })
        .eq("workspace_id", workspaceId);
      if (updateError) throw updateError;

      return NextResponse.json({ subscriptionId: subscription.id });
    } finally {
      const { error: unlockError } = await admin
        .from("billing_checkout_locks")
        .delete()
        .eq("workspace_id", workspaceId);
      if (unlockError) console.error("Checkout lock cleanup failed:", unlockError);
    }
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json({ error: "Failed to create checkout" }, { status: 500 });
  }
}
