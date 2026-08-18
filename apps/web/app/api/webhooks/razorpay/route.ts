import { NextResponse } from "next/server";
import crypto from "crypto";
import { requireRazorpayServerConfig } from "@/lib/razorpay/env";
import { getPlanByRazorpayId } from "@/lib/razorpay/config";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const config = requireRazorpayServerConfig();

    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    const expectedSignature = crypto
      .createHmac("sha256", config.webhookSecret)
      .update(rawBody)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    const receivedBuffer = Buffer.from(signature, "hex");

    if (expectedBuffer.length !== receivedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(rawBody);

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Webhook processing is unavailable: SUPABASE_SERVICE_ROLE_KEY is not configured." },
        { status: 503 },
      );
    }
    const supabase = createAdminClient(serviceRoleKey);

    switch (event.event) {
      case "subscription.activated":
      case "subscription.charged": {
        const subscription = event.payload.subscription.entity;
        const customerId = subscription.customer_id;
        const workspaceId = subscription.notes?.workspace_id;
        const plan = getPlanByRazorpayId(subscription.plan_id);

        if (!workspaceId) {
          return NextResponse.json({ error: "Subscription is missing workspace_id" }, { status: 400 });
        }

        const tier = plan ? plan.tier : "pro";

        await supabase
          .from("workspace_subscriptions")
          .upsert({
            workspace_id: workspaceId,
            razorpay_customer_id: customerId,
            razorpay_subscription_id: subscription.id,
            tier,
            status: subscription.status,
            current_period_end: new Date(subscription.current_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          });
        break;
      }
      case "subscription.cancelled":
      case "subscription.halted": {
        const subscription = event.payload.subscription.entity;

        const { data: sub } = await supabase
          .from("workspace_subscriptions")
          .select("workspace_id")
          .eq("razorpay_subscription_id", subscription.id)
          .single();

        if (sub) {
          await supabase
            .from("workspace_subscriptions")
            .update({
              status: subscription.status,
              updated_at: new Date().toISOString(),
            })
            .eq("workspace_id", sub.workspace_id);
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}