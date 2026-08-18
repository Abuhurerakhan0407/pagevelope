import { NextResponse } from "next/server";
import { getRazorpayClient } from "@/lib/razorpay/client";
import { getPlan, isPlanCheckoutReady } from "@/lib/razorpay/config";
import { getRazorpayServerConfig } from "@/lib/razorpay/env";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    if (!getRazorpayServerConfig()) {
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
    const { data: membership } = await supabase
      .from("workspace_memberships")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .single();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Create a subscription
    const subscription = await getRazorpayClient().subscriptions.create({
      plan_id: plan.razorpayPlanId as string,
      total_count: 120, // number of billing cycles
      customer_notify: 1,
      notes: {
        workspace_id: workspaceId,
        plan: plan.id,
      },
    });

    return NextResponse.json({
      subscriptionId: subscription.id,
    });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json({ error: "Failed to create checkout" }, { status: 500 });
  }
}