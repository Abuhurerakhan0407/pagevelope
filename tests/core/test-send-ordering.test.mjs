import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const path = new URL("../../supabase/migrations/20260817183000_test_send_before_inbox_evidence.sql", import.meta.url);
const sql = readFileSync(path, "utf8");
const normalized = sql.replace(/--.*$/gm, "").replace(/\s+/g, " ").trim().toLowerCase();

test("latest test-send ordering keeps candidate integrity but removes the inbox precondition", () => {
  assert.match(normalized, /create or replace function public\.create_test_send_attempt/);
  assert.match(normalized, /candidate_version <> current_version/);
  assert.match(normalized, /campaign_status <> 'review'::public\.campaign_status/);
  assert.match(normalized, /release candidate has changes requested/);
  assert.doesNotMatch(normalized, /release_candidate_inbox_passed/);
  assert.doesNotMatch(normalized, /required inbox evidence must pass before a test send/);
});

test("browser clients can only queue while final provider completion remains server-only elsewhere", () => {
  assert.match(normalized, /revoke all on function public\.create_test_send_attempt\(uuid, uuid, text\) from public, anon/);
  assert.match(normalized, /grant execute on function public\.create_test_send_attempt\(uuid, uuid, text\) to authenticated/);
  assert.match(normalized, /recent_count >= 5/);
  assert.match(normalized, /inbox_evidence_required_for_final_approval', true/);
});
