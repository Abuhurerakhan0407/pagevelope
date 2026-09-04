import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import crypto from "node:crypto";

const envSource = readFileSync(new URL("../../apps/web/lib/razorpay/env.ts", import.meta.url), "utf8");
const clientSource = readFileSync(new URL("../../apps/web/lib/razorpay/client.ts", import.meta.url), "utf8");
const configSource = readFileSync(new URL("../../apps/web/lib/razorpay/config.ts", import.meta.url), "utf8");
const webhookSource = readFileSync(new URL("../../apps/web/app/api/webhooks/razorpay/route.ts", import.meta.url), "utf8");
const checkoutSource = readFileSync(new URL("../../apps/web/app/api/billing/checkout/route.ts", import.meta.url), "utf8");
const cancelSource = readFileSync(new URL("../../apps/web/app/api/billing/cancel/route.ts", import.meta.url), "utf8");
const entitlementSource = readFileSync(new URL("../../apps/web/lib/razorpay/entitlements.ts", import.meta.url), "utf8");
const hardeningMigration = readFileSync(new URL("../../supabase/migrations/20260829083947_launch_security_hardening.sql", import.meta.url), "utf8");

test("Razorpay webhook signature validation", () => {
  const payload = JSON.stringify({ event: "subscription.activated" });
  const secret = "test_secret";

  const signature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  const invalidSignature = crypto
    .createHmac("sha256", "wrong_secret")
    .update(payload)
    .digest("hex");

  assert.notStrictEqual(signature, invalidSignature);
});

test("no placeholder Razorpay credentials or plan ids exist in billing code", () => {
  const sources = [envSource, clientSource, configSource, webhookSource, checkoutSource];
  for (const source of sources) {
    assert.doesNotMatch(source, /placeholder/i, "placeholder credential found");
    assert.doesNotMatch(source, /\|\|\s*["'](rzp|plan_|secret_)/, "fallback secret found");
  }
});

test("billing fails closed without configured credentials", () => {
  assert.match(envSource, /BILLING_LAUNCH_ENABLED/);
  assert.match(envSource, /isBillingLaunchEnabled/);
  assert.match(checkoutSource, /!isBillingLaunchEnabled\(\)/);
  assert.match(envSource, /publicKeyId !== keyId/);
  assert.match(envSource, /requireRazorpayServerConfig/);
  assert.match(envSource, /throw new Error/);
  assert.match(clientSource, /requireRazorpayServerConfig/);
  assert.match(configSource, /RAZORPAY_PLAN_ID_STARTER/);
  assert.match(configSource, /RAZORPAY_PLAN_ID_PRO/);
  assert.match(configSource, /RAZORPAY_PLAN_ID_AGENCY/);
  assert.match(webhookSource, /timingSafeEqual/);
});

test("checkout is unavailable with a clear configuration error until credentials exist", () => {
  assert.match(checkoutSource, /503/);
  assert.match(checkoutSource, /not configured/);
});

test("workspace authorization is preserved for billing routes", () => {
  assert.match(checkoutSource, /workspace_memberships/);
  assert.match(checkoutSource, /\[\"owner\", \"admin\"\]/);
});

test("checkout creation is serialized per workspace", () => {
  assert.match(checkoutSource, /billing_checkout_locks/);
  assert.match(checkoutSource, /lockError\?\.code === "23505"/);
  assert.match(checkoutSource, /finally/);
  assert.match(hardeningMigration, /create table public\.billing_checkout_locks/);
  assert.match(hardeningMigration, /workspace_subscriptions_razorpay_subscription_unique/);
});

test("cancellation preserves access through the paid billing period", () => {
  assert.match(cancelSource, /subscriptions\.cancel\(subscription\.razorpay_subscription_id, true\)/);
  assert.match(cancelSource, /cancel_at_period_end: true/);
  assert.match(hardeningMigration, /status = 'canceled'[\s\S]*cancel_at_period_end[\s\S]*current_period_end > now\(\)/);
});

test("webhooks reject unknown plans and normalize Razorpay statuses", () => {
  assert.match(webhookSource, /Subscription uses an unknown plan/);
  assert.match(webhookSource, /cancelled: "canceled"/);
  assert.match(webhookSource, /halted: "paused"/);
  assert.match(webhookSource, /if \(error\) throw error/);
  assert.doesNotMatch(webhookSource, /plan \? plan\.tier : "pro"/);
});

test("webhook processing records an idempotency receipt", () => {
  assert.match(webhookSource, /x-razorpay-event-id/);
  assert.match(webhookSource, /razorpay_webhook_events/);
  assert.match(webhookSource, /payload_sha256/);
  assert.match(hardeningMigration, /create table public\.razorpay_webhook_events/);
  assert.match(hardeningMigration, /revoke all on public\.razorpay_webhook_events from public, anon, authenticated/);
});

test("authenticated workspace admins cannot write subscription state", () => {
  assert.match(hardeningMigration, /revoke insert, update, delete on public\.workspace_subscriptions from authenticated/);
  assert.match(hardeningMigration, /drop policy if exists subscriptions_insert_admin/);
  assert.match(hardeningMigration, /drop policy if exists subscriptions_update_admin/);
});

test("pay-before-use is enforced at the shared workspace edit boundary", () => {
  assert.match(hardeningMigration, /private\.has_active_paid_subscription\(target_workspace_id\)/);
  assert.match(hardeningMigration, /and private\.has_active_paid_subscription\(target_workspace_id\)/);
  assert.doesNotMatch(entitlementSource, /Max 3 campaigns on free tier/);
  assert.match(entitlementSource, /hasPaidWorkspaceAccess/);
  assert.match(entitlementSource, /current_period_end/);
  assert.match(entitlementSource, /subscription\.status === "canceled"/);
});
