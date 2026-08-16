import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pagePath = new URL("../../apps/web/app/review/[candidateId]/page.tsx", import.meta.url);
const actionsPath = new URL("../../apps/web/app/review/[candidateId]/actions.ts", import.meta.url);
const page = readFileSync(pagePath, "utf8");
const actions = readFileSync(actionsPath, "utf8");

test("release review surfaces a provider-confirmed test send between inbox proof and approval", () => {
  assert.match(page, /Test delivery/);
  assert.match(page, /Send test email/);
  assert.match(page, /successful_test_send_count/);
  assert.match(page, /Provider-confirmed test delivery exists/);
  assert.ok(page.indexOf("Test delivery") < page.indexOf("Immutable decision"));
});

test("positive approval stays unavailable in the UI until test delivery succeeds", () => {
  assert.match(page, /const testPassed = readiness\.successful_test_send_count > 0/);
  assert.match(page, /value="approved" disabled=\{!testPassed\}/);
  assert.match(actions, /error\.code === "23514"[\s\S]*"test-send-required"/);
});

test("test-send action never accepts HTML from form data", () => {
  assert.match(actions, /formData\.get\("recipientEmail"\)/);
  assert.doesNotMatch(actions, /formData\.get\("html"\)/);
  assert.doesNotMatch(actions, /formData\.get\("plainText"\)/);
});
