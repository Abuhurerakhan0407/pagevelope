import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const providerPath = new URL("../../apps/web/lib/test-send/resend.ts", import.meta.url);
const actionsPath = new URL("../../apps/web/app/review/[candidateId]/actions.ts", import.meta.url);
const envPath = new URL("../../.env.example", import.meta.url);
const provider = readFileSync(providerPath, "utf8");
const actions = readFileSync(actionsPath, "utf8");
const env = readFileSync(envPath, "utf8");

test("Resend credentials stay server-only and the provider call is idempotent", () => {
  assert.match(provider, /process\.env\.RESEND_API_KEY/);
  assert.match(provider, /process\.env\.RESEND_FROM_EMAIL/);
  assert.doesNotMatch(env, /NEXT_PUBLIC_RESEND/);
  assert.match(provider, /https:\/\/api\.resend\.com\/emails/);
  assert.match(provider, /"Idempotency-Key": `pagevelope-test-\$\{input\.attemptId\}`/);
  assert.match(provider, /AbortSignal\.timeout\(10_000\)/);
});

test("test delivery sends deterministic release HTML and plain text, not client HTML", () => {
  assert.match(actions, /renderCampaignRelease\(version\.source_json\)/);
  assert.match(actions, /stableStringify\(release\.manifest\)/);
  assert.match(actions, /release\.manifest\.sourceFingerprint !== candidate\.source_sha256/);
  assert.match(actions, /manifestSha256 !== candidate\.manifest_sha256/);
  assert.match(actions, /html: release\.html/);
  assert.match(actions, /text: release\.plainText/);
});

test("provider success is completed through the service-role database boundary", () => {
  assert.match(actions, /process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(actions, /createAdminClient\(serviceRoleKey\)/);
  assert.match(actions, /complete_test_send_attempt/);
  assert.match(actions, /"sent",\s*providerMessageId/);
  assert.match(actions, /test-send-record-failed/);
});
