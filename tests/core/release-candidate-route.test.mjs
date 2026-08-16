import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const routePath = new URL("../../apps/web/app/api/campaigns/[campaignId]/release-candidates/route.ts", import.meta.url);
const source = readFileSync(routePath, "utf8");

test("release candidate route renders only the persisted immutable source", () => {
  assert.match(source, /from\("campaign_versions"\)/);
  assert.match(source, /renderCampaignRelease\(version\.source_json\)/);
  assert.doesNotMatch(source, /renderCampaignRelease\(body\./);
});

test("release candidate route verifies deterministic source fingerprint before database review", () => {
  assert.match(source, /release\.manifest\.sourceFingerprint !== version\.source_sha256/);
  assert.match(source, /SOURCE_FINGERPRINT_MISMATCH/);
  assert.match(source, /stableStringify\(manifestJson\)/);
  assert.match(source, /createHash\("sha256"\)/);
});

test("release candidate route delegates authorization and immutability to the database RPC", () => {
  assert.match(source, /supabase\.rpc\("create_release_candidate"/);
  assert.match(source, /target_version_number: version\.version_number/);
  assert.match(source, /source_sha256: version\.source_sha256/);
  assert.match(source, /manifest_sha256: manifestSha256/);
  assert.match(source, /qa_status: release\.manifest\.qa\.status/);
});

test("release candidate route fails closed for unsaved, stale, approved, or blocked campaigns", () => {
  assert.match(source, /VERSION_REQUIRED/);
  assert.match(source, /CAMPAIGN_NOT_EDITABLE/);
  assert.match(source, /RELEASE_BLOCKED/);
  assert.match(source, /VERSION_CONFLICT/);
});
