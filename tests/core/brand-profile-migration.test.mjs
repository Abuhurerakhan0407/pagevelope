import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL("../../supabase/migrations/20260816190000_brand_profiles.sql", import.meta.url);
const sql = readFileSync(migrationPath, "utf8");
const normalized = sql.replace(/--.*$/gm, "").replace(/\s+/g, " ").trim().toLowerCase();

test("brand production tokens are constrained", () => {
  for (const field of ["primary_color", "accent_color", "background_color", "text_color"]) {
    assert.match(normalized, new RegExp(`brands_${field}_hex check \\(${field} ~ '\\^#\\[0-9a-fa-f\\]\\{6\\}\\$'\\)`));
  }
  assert.match(normalized, /brands_website_https check \(website_url is null or website_url ~ '\^https:\/\/'\)/);
  assert.match(normalized, /brands_legal_address_length check/);
});

test("brand creation RPC explicitly authorizes the caller", () => {
  assert.match(normalized, /create or replace function public\.create_brand_profile/);
  assert.match(normalized, /security definer set search_path = ''/);
  assert.match(normalized, /if not private\.can_edit_workspace\(target_workspace_id\) then raise exception 'workspace edit access required\.'/);
  assert.match(normalized, /revoke all on function public\.create_brand_profile[^;]+ from public, anon;/);
  assert.match(normalized, /grant execute on function public\.create_brand_profile[^;]+ to authenticated;/);
});

test("brand creation is audited atomically", () => {
  assert.match(normalized, /insert into public\.audit_events/);
  assert.match(normalized, /'brand\.created'/);
  assert.match(normalized, /^begin;/);
  assert.match(normalized, /commit;$/);
});

test("logo asset foreign key preserves the tenant boundary", () => {
  assert.match(normalized, /unique \(workspace_id, id\)/);
  assert.match(normalized, /foreign key \(workspace_id, logo_asset_id\) references public\.assets\(workspace_id, id\)/);
  assert.match(normalized, /on delete set null \(logo_asset_id\)/);
});
