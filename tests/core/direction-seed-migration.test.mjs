import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL("../../supabase/migrations/20260816202500_direction_seed_atomic.sql", import.meta.url);
const sql = readFileSync(migrationPath, "utf8");
const normalized = sql.replace(/--.*$/gm, "").replace(/\s+/g, " ").trim().toLowerCase();

test("direction selection and seed are one transactional security-definer RPC", () => {
  assert.match(normalized, /^begin;/);
  assert.match(normalized, /create or replace function public\.select_campaign_direction_and_seed/);
  assert.match(normalized, /security definer/);
  assert.match(normalized, /set search_path = ''/);
  assert.match(normalized, /private\.can_edit_workspace\(target_workspace_id\)/);
  assert.match(normalized, /public\.save_campaign_version\(/);
  assert.match(normalized, /commit;$/);
});

test("direction seed checks brief, direction membership, and optimistic version before mutation", () => {
  assert.match(normalized, /c\.current_version_number = expected_current_version/);
  assert.match(normalized, /c\.brief_completed_at is not null/);
  assert.match(normalized, /jsonb_array_elements\(c\.creative_directions\)/);
  assert.match(normalized, /where direction ->> 'key' = clean_key/);
  assert.match(normalized, /using errcode = '40001'/);
});

test("direction seed remains authenticated-only and audited", () => {
  assert.match(normalized, /campaign\.direction\.selected/);
  assert.match(normalized, /revoke all on function public\.select_campaign_direction_and_seed/);
  assert.match(normalized, /grant execute on function public\.select_campaign_direction_and_seed/);
});
