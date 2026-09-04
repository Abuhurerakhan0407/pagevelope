import { NextResponse } from "next/server";
import crypto from "crypto";
import { requireRazorpayServerConfig } from "@/lib/razorpay/env";
import { getPlanByRazorpayId } from "@/lib/razorpay/config";
import { createAdminClient } from "@/lib/supabase/admin";

type SubscriptionStatus = "active" | "past_due" | "canceled" | "unpaid" | "incomplete" | "incomplete_expired" | "trialing" | "paused";

type RazorpaySubscription = {
  id: string;
  plan_id?: string;
  customer_id?: string;
  status: string;
  current_end?: number;
  notes?: { workspace_id?: string };
};

const STATUS_MAP: Record<string, SubscriptionStatus> = {
  created: "incomplete",
  authenticated: "incomplete",
  active: "active",
  pending: "past_due",
  halted: "paused",
  paused: "paused",
  cancelled: "canceled",
  completed: "canceled",
  expired: "incomplete_expired",
};

function parseWebhookBody(value: unknown): { eventName: string; subscription?: RazorpaySubscription } | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (typeof body.event !== "string") return null;
  const payload = body.payload;
  if (!payload || typeof payload !== "object") return { eventName: body.event };
  const wrapper = (payload as Record<string, unknown>).subscription;
  if (!wrapper || typeof wrapper !== "object") return { eventName: body.event };
  const entity = (wrapper as Record<string, unknown>).entity;
  if (!entity || typeof entity !== "object") return { eventName: body.event };
  const subscription = entity as Partial<RazorpaySubscription>;
  if (typeof subscription.id !== "string" || typeof subscription.status !== "string") return { eventName: body.event };
  return { eventName: body.event, subscription: subscription as RazorpaySubscription };
}

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

    const event = parseWebhookBody(JSON.parse(rawBody) as unknown);
    if (!event) {
      return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Webhook processing is unavailable: SUPABASE_SERVICE_ROLE_KEY is not configured." },
        { status: 503 },
      );
    }
    const supabase = createAdminClient(serviceRoleKey);
    const eventId = req.headers.get("x-razorpay-event-id")?.trim() || crypto.createHash("sha256").update(rawBody).digest("hex");
    const payloadSha256 = crypto.createHash("sha256").update(rawBody).digest("hex");
    const { data: processedEvent, error: processedEventError } = await supabase
      .from("razorpay_webhook_events")
      .select("payload_sha256")
      .eq("event_id", eventId)
      .maybeSingle();
    if (processedEventError) throw processedEventError;
    if (processedEvent) {
      if (processedEvent.payload_sha256 !== payloadSha256) {
        return NextResponse.json({ error: "Webhook event ID was reused with different content" }, { status: 409 });
      }
      return NextResponse.json({ received: true, duplicate: true });
    }

    switch (event.eventName) {
      case "subscription.activated":
      case "subscription.charged": {
        const subscription = event.subscription;
        if (!subscription) {
          return NextResponse.json({ error: "Subscription payload is missing" }, { status: 400 });
        }
        const customerId = subscription.customer_id;
        const workspaceId = subscription.notes?.workspace_id;
        const plan = subscription.plan_id ? getPlanByRazorpayId(subscription.plan_id) : undefined;
        const status = STATUS_MAP[subscription.status];

        if (!workspaceId) {
          return NextResponse.json({ error: "Subscription is missing workspace_id" }, { status: 400 });
        }
        if (!plan) {
          return NextResponse.json({ error: "Subscription uses an unknown plan" }, { status: 400 });
        }
        if (!status) {
          return NextResponse.json({ error: "Subscription uses an unknown status" }, { status: 400 });
        }

        const { error } = await supabase
          .from("workspace_subscriptions")
          .upsert({
            workspace_id: workspaceId,
            razorpay_customer_id: customerId,
            razorpay_subscription_id: subscription.id,
            tier: plan.tier,
            status,
            current_period_end: subscription.current_end
              ? new Date(subscription.current_end * 1000).toISOString()
              : null,
            cancel_at_period_end: false,
            updated_at: new Date().toISOString(),
          });
        if (error) throw error;
        break;
      }
      case "subscription.cancelled":
      case "subscription.halted":
      case "subscription.pending":
      case "subscription.completed":
      case "subscription.expired":
      case "subscription.paused":
      case "subscription.resumed":
      case "subscription.updated": {
        const subscription = event.subscription;
        if (!subscription) {
          return NextResponse.json({ error: "Subscription payload is missing" }, { status: 400 });
        }
        const status = STATUS_MAP[subscription.status];
        if (!status) {
          return NextResponse.json({ error: "Subscription uses an unknown status" }, { status: 400 });
        }

        const { data: sub, error: lookupError } = await supabase
          .from("workspace_subscriptions")
          .select("workspace_id")
          .eq("razorpay_subscription_id", subscription.id)
          .maybeSingle();
        if (lookupError) throw lookupError;
        if (!sub) {
          return NextResponse.json({ error: "Subscription was not found" }, { status: 409 });
        }

        const { error } = await supabase
          .from("workspace_subscriptions")
          .update({
            status,
            current_period_end: subscription.current_end
              ? new Date(subscription.current_end * 1000).toISOString()
              : undefined,
            updated_at: new Date().toISOString(),
          })
          .eq("workspace_id", sub.workspace_id);
        if (error) throw error;
        break;
      }
    }

    const { error: receiptError } = await supabase.from("razorpay_webhook_events").insert({
      event_id: eventId,
      event_name: event.eventName,
      payload_sha256: payloadSha256,
    });
    if (receiptError && receiptError.code !== "23505") throw receiptError;

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
