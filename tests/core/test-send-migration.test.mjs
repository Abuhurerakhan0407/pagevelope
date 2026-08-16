import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const path = new URL("../../supabase/migrations/20260816230000_test_send_boundary.sql", import.meta.url);
const sql = readFileSync(path, "utf8");
const normalized = sql.replace(/--.*$/gm, "").replace(/\s+/g, " ").trim().toLowerCase();

test("test sends are tenant scoped, RLS protected, and RPC-only for writes", () => {
  assert.match(normalized, /create table public\.campaign_test_sends/);
  assert.match(normalized, /foreign key \(workspace_id, release_candidate_id\)/);
  assert.match(normalized, /alter table public\.campaign_test_sends enable row level security/);
  assert.match(normalized, /revoke all on public\.campaign_test_sends from anon, authenticated/);
  assert.match(normalized, /grant select on public\.campaign_test_sends to authenticated/);
});

test("test send attempt requires current release candidate and completed Inbox Lab", () => {
  assert.match(normalized, /candidate_version <> current_version/);
  assert.match(normalized, /private\.release_candidate_inbox_passed/);
  assert.match(normalized, /required inbox evidence must pass before a test send/);
  assert.match(normalized, /campaign_status not in \('review'/);
});

test("single-recipient test delivery is rate limited before external provider work", () => {
  assert.match(normalized, /target_recipient_email text/);
  assert.match(normalized, /recent_count >= 5/);
  assert.match(normalized, /interval '10 minutes'/);
  assert.match(normalized, /test send rate limit reached/);
});

test("test-send completion is terminal and bound to the initiating editor", () => {
  assert.match(normalized, /create or replace function public\.complete_test_send_attempt/);
  assert.match(normalized, /ts\.created_by = caller_id/);
  assert.match(normalized, /ts\.status = 'queued'::public\.test_send_status/);
  assert.match(normalized, /test send attempt is unavailable or already completed/);
});

test("approval requires a successful test delivery and never publishes", () => {
  assert.match(normalized, /a successful test send is required before approval/);
  assert.match(normalized, /successful_test_sends > 0/);
  assert.doesNotMatch(normalized, /set status = 'published'/);
});
