import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../../apps/web/app/api/release-candidates/[candidateId]/", import.meta.url);
const statusRoute = readFileSync(new URL("route.ts", root), "utf8");
const evidenceRoute = readFileSync(new URL("inbox-evidence/route.ts", root), "utf8");
const approvalRoute = readFileSync(new URL("approval/route.ts", root), "utf8");
const finalizeRoute = readFileSync(new URL("finalize/route.ts", root), "utf8");

test("release review status is read through RLS-backed tables plus readiness RPC", () => {
  assert.match(statusRoute, /from\("campaign_release_candidates"\)/);
  assert.match(statusRoute, /from\("inbox_evidence"\)/);
  assert.match(statusRoute, /from\("campaign_approvals"\)/);
  assert.match(statusRoute, /rpc\("release_candidate_readiness"/);
});

test("inbox evidence API accepts only required clients and requires proof for pass", () => {
  for (const client of ["gmail-web", "apple-mail", "outlook-windows"]) {
    assert.match(evidenceRoute, new RegExp(client));
  }
  assert.match(evidenceRoute, /status === "pass" && !evidenceUrl/);
  assert.match(evidenceRoute, /rpc\("record_inbox_evidence"/);
  assert.match(evidenceRoute, /Reviewer access is required/);
});

test("approval API records immutable reviewer decisions without changing campaign status itself", () => {
  assert.match(approvalRoute, /approved/);
  assert.match(approvalRoute, /changes_requested/);
  assert.match(approvalRoute, /rpc\("record_campaign_approval"/);
  assert.match(approvalRoute, /APPROVAL_EXISTS/);
  assert.doesNotMatch(approvalRoute, /from\("campaigns"\)\.update/);
});

test("finalize API delegates the fail-closed transition to the approval RPC and never publishes", () => {
  assert.match(finalizeRoute, /rpc\("approve_release_candidate"/);
  assert.match(finalizeRoute, /RELEASE_NOT_READY/);
  assert.match(finalizeRoute, /VERSION_CONFLICT/);
  assert.doesNotMatch(finalizeRoute, /published/);
});
