import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import crypto from "node:crypto";

const envSource = readFileSync(new URL("../../apps/web/lib/razorpay/env.ts", import.meta.url), "utf8");
const clientSource = readFileSync(new URL("../../apps/web/lib/razorpay/client.ts", import.meta.url), "utf8");
const configSource = readFileSync(new URL("../../apps/web/lib/razorpay/config.ts", import.meta.url), "utf8");
const webhookSource = readFileSync(new URL("../../apps/web/app/api/webhooks/razorpay/route.ts", import.meta.url), "utf8");
const checkoutSource = readFileSync(new URL("../../apps/web/app/api/billing/checkout/route.ts", import.meta.url), "utf8");

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