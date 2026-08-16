import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const path = new URL("../../supabase/migrations/20260816231500_test_send_boundary.sql", import.meta.url);
const sql = readFileSync(path, "utf8");
const normalized = sql.replace(/--.*$/gm, "").replace(/\s+/g, " ").trim().toLowerCase();

test("test sends are tenant scoped, RLS protected, and direct writes stay closed", () => {
  assert.match(normalized, /create table public\.campaign_test_sends/);
  assert.match(normalized, /foreign key \(workspace_id, release_candidate_id\)/);
  assert.match(normalized, /alter table public\.campaign_test_sends enable row level security/);
  assert.match(normalized, /revoke all on public\.campaign_test_sends from anon, authenticated/);
  assert.match(normalized, /grant select on public\.campaign_test_sends to authenticated/);
});

test("test send creation requires the current review candidate and completed Inbox Lab", () => {
  assert.match(normalized, /candidate_version <> current_version/);
  assert.match(normalized, /campaign_status <> 'review'::public\.campaign_status/);
  assert.match(normalized, /private\.release_candidate_inbox_passed/);
  assert.match(normalized, /required inbox evidence must pass before a test send/);
  assert.match(normalized, /release candidate has changes requested/);
});

test("single-recipient test delivery is rate limited before provider work", () => {
  assert.match(normalized, /target_recipient_email text/);
  assert.match(normalized, /recent_count >= 5/);
  assert.match(normalized, /interval '10 minutes'/);
  assert.match(normalized, /test send rate limit reached/);
});

test("only the server service role can record provider completion", () => {
  assert.match(normalized, /create or replace function public\.complete_test_send_attempt/);
  assert.match(normalized, /ts\.status = 'queued'::public\.test_send_status/);
  assert.match(normalized, /from public, anon, authenticated/);
  assert.match(normalized, /grant execute on function public\.complete_test_send_attempt[\s\S]*to service_role/);
  assert.match(normalized, /'completed_by', 'server'/);
});

test("positive approval requires a provider-confirmed test send and never publishes", () => {
  assert.match(normalized, /approval_decision = 'approved'::public\.approval_decision/);
  assert.match(normalized, /a successful test send is required before approval/);
  assert.match(normalized, /successful_test_sends > 0/);
  assert.doesNotMatch(normalized, /set status = 'published'/);
});
