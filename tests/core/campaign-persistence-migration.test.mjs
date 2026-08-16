import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL("../../supabase/migrations/20260816194000_campaign_persistence.sql", import.meta.url);
const sql = readFileSync(migrationPath, "utf8");
const normalized = sql.replace(/--.*$/gm, "").replace(/\s+/g, " ").trim().toLowerCase();

test("campaign draft RPC authorizes workspace editing explicitly", () => {
  assert.match(normalized, /create or replace function public\.create_campaign_draft/);
  assert.match(normalized, /security definer set search_path = ''/);
  assert.match(normalized, /if not private\.can_edit_workspace\(target_workspace_id\) then raise exception 'workspace edit access required\.'/);
  assert.match(normalized, /brand does not belong to the workspace/);
  assert.match(normalized, /'campaign\.created'/);
});

test("version RPC uses optimistic concurrency and immutable version rows", () => {
  assert.match(normalized, /create or replace function public\.save_campaign_version/);
  assert.match(normalized, /c\.current_version_number = expected_current_version/);
  assert.match(normalized, /set current_version_number = c\.current_version_number \+ 1/);
  assert.match(normalized, /insert into public\.campaign_versions/);
  assert.match(normalized, /raise exception 'campaign version conflict or campaign is not editable\.' using errcode = '40001'/);
});

test("saved source is bound to schema, campaign id, and sha-256", () => {
  assert.match(normalized, /campaign_schema_version := source_json ->> 'schemaversion'/);
  assert.match(normalized, /source_json ->> 'id' <> target_campaign_id::text/);
  assert.match(normalized, /source_sha256 !~ '\^\[0-9a-f\]\{64\}\$'/);
  assert.match(normalized, /'campaign\.version\.created'/);
});

test("campaign persistence RPCs are authenticated-only and transactional", () => {
  assert.match(normalized, /revoke all on function public\.create_campaign_draft\(uuid, uuid, text\) from public, anon;/);
  assert.match(normalized, /grant execute on function public\.create_campaign_draft\(uuid, uuid, text\) to authenticated;/);
  assert.match(normalized, /revoke all on function public\.save_campaign_version\(uuid, uuid, integer, jsonb, text\) from public, anon;/);
  assert.match(normalized, /grant execute on function public\.save_campaign_version\(uuid, uuid, integer, jsonb, text\) to authenticated;/);
  assert.match(normalized, /^begin;/);
  assert.match(normalized, /commit;$/);
});
