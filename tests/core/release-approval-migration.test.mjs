import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL("../../supabase/migrations/20260816223000_release_approval_gates.sql", import.meta.url);
const sql = readFileSync(migrationPath, "utf8");
const normalized = sql.replace(/--.*$/gm, "").replace(/\s+/g, " ").trim().toLowerCase();

test("release candidates, inbox evidence, and approvals are tenant scoped", () => {
  for (const table of ["campaign_release_candidates", "inbox_evidence", "campaign_approvals"]) {
    assert.match(normalized, new RegExp(`create table public\\.${table}`));
    assert.match(normalized, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.match(normalized, /foreign key \(workspace_id, campaign_id\)/);
  assert.match(normalized, /foreign key \(workspace_id, release_candidate_id\)/);
});

test("release candidate creation binds deterministic renderer evidence to the current immutable version", () => {
  assert.match(normalized, /create or replace function public\.create_release_candidate/);
  assert.match(normalized, /campaign_current_version <> target_version_number/);
  assert.match(normalized, /expected_source_sha <> source_sha256/);
  assert.match(normalized, /manifest_json #>> '\{qa,status\}'/);
  assert.match(normalized, /blocking qa cannot become a release candidate/);
  assert.match(normalized, /campaign\.release_candidate\.created/);
});

test("publish readiness requires three inbox clients plus immutable reviewer approval", () => {
  assert.match(normalized, /gmail-web/);
  assert.match(normalized, /apple-mail/);
  assert.match(normalized, /outlook-windows/);
  assert.match(normalized, /passed_clients = cardinality\(required_clients\)/);
  assert.match(normalized, /approval_count > 0/);
  assert.match(normalized, /changes_requested_count = 0/);
  assert.match(normalized, /campaign_current_version = target_version/);
});

test("approval records are append-only through RPCs for authenticated users", () => {
  assert.match(normalized, /unique \(release_candidate_id, created_by\)/);
  assert.match(normalized, /a reviewer decision for this release candidate is immutable/);
  assert.match(normalized, /revoke all on public\.campaign_approvals from anon, authenticated/);
  assert.match(normalized, /grant select on public\.campaign_approvals to authenticated/);
  assert.match(normalized, /grant execute on function public\.record_campaign_approval/);
});

test("approval can advance to approved but this migration never publishes a campaign", () => {
  assert.match(normalized, /set status = 'approved'::public\.campaign_status/);
  assert.doesNotMatch(normalized, /set status = 'published'::public\.campaign_status/);
  assert.match(normalized, /campaign\.approved/);
});
