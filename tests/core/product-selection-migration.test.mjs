import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL("../../supabase/migrations/20260816210000_product_selection.sql", import.meta.url);
const integrityPath = new URL("../../supabase/migrations/20260816211000_product_selection_integrity.sql", import.meta.url);
const sql = readFileSync(migrationPath, "utf8");
const integritySql = readFileSync(integrityPath, "utf8");
const normalized = sql.replace(/--.*$/gm, "").replace(/\s+/g, " ").trim().toLowerCase();
const normalizedIntegrity = integritySql.replace(/--.*$/gm, "").replace(/\s+/g, " ").trim().toLowerCase();

test("product catalog and campaign selection are tenant-scoped and RLS protected", () => {
  assert.match(normalized, /create table public\.products/);
  assert.match(normalized, /create table public\.campaign_products/);
  assert.match(normalized, /foreign key \(workspace_id, brand_id\)/);
  assert.match(normalized, /foreign key \(workspace_id, campaign_id\)/);
  assert.match(normalized, /foreign key \(workspace_id, product_id\)/);
  assert.match(normalized, /alter table public\.products enable row level security/);
  assert.match(normalized, /alter table public\.campaign_products enable row level security/);
  assert.match(normalized, /to authenticated/);
});

test("manual product creation validates price, currency, and HTTPS links", () => {
  assert.match(normalized, /create or replace function public\.create_manual_product/);
  assert.match(normalized, /product_price < 0/);
  assert.match(normalized, /clean_currency !~ '\^\[a-z\]\{3\}\$'/);
  assert.match(normalized, /clean_image_url !~ '\^https:\/\/'/);
  assert.match(normalized, /clean_product_url !~ '\^https:\/\/'/);
  assert.match(normalized, /product\.created/);
});

test("campaign product selection is constrained to one through six same-brand products", () => {
  assert.match(normalized, /selected_count < 1 or selected_count > 6/);
  assert.match(normalized, /duplicate products are not allowed/);
  assert.match(normalized, /p\.brand_id = campaign_brand_id/);
  assert.match(normalized, /p\.id = any\(product_ids\)/);
  assert.match(normalized, /campaign\.products\.updated/);
});

test("changing products invalidates downstream brief and direction state", () => {
  assert.match(normalized, /product_selection_completed_at = now\(\)/);
  assert.match(normalized, /brief_completed_at = null/);
  assert.match(normalized, /creative_directions = '\[\]'::jsonb/);
  assert.match(normalized, /selected_direction_key = null/);
  assert.match(normalized, /campaigns_require_products_before_brief/);
  assert.match(normalizedIntegrity, /campaign_products_invalidate_downstream/);
});

test("product RPCs are security-definer, permission checked, and authenticated-only", () => {
  for (const fn of ["create_manual_product", "set_campaign_products"]) {
    const pattern = new RegExp(`create or replace function public\\.${fn}\\([\\s\\S]*?\\)[\\s\\S]*?security definer[\\s\\S]*?set search_path = ''`, "i");
    assert.match(sql, pattern);
  }
  assert.match(normalized, /private\.can_edit_workspace\(target_workspace_id\)/);
  assert.match(normalized, /revoke all on function public\.create_manual_product/);
  assert.match(normalized, /grant execute on function public\.create_manual_product/);
  assert.match(normalized, /revoke all on function public\.set_campaign_products/);
  assert.match(normalized, /grant execute on function public\.set_campaign_products/);
});

test("authenticated clients can read product selection but cannot mutate tables directly", () => {
  assert.match(normalizedIntegrity, /revoke all on public\.products from anon, authenticated/);
  assert.match(normalizedIntegrity, /revoke all on public\.campaign_products from anon, authenticated/);
  assert.match(normalizedIntegrity, /grant select on public\.products to authenticated/);
  assert.match(normalizedIntegrity, /grant select on public\.campaign_products to authenticated/);
  assert.doesNotMatch(normalizedIntegrity, /grant (?:insert|update|delete|select, insert|all).*public\.products to authenticated/);
  assert.doesNotMatch(normalizedIntegrity, /grant (?:insert|update|delete|select, insert|all).*public\.campaign_products to authenticated/);
});

test("database-level integrity prevents cross-brand links and stale downstream state", () => {
  assert.match(normalizedIntegrity, /campaign_products_require_same_brand/);
  assert.match(normalizedIntegrity, /campaign_brand_id <> product_brand_id/);
  assert.match(normalizedIntegrity, /campaigns_require_product_integrity/);
  assert.match(normalizedIntegrity, /campaign product selection must contain between one and six products/);
  assert.match(normalizedIntegrity, /selected direction must exist in the generated direction set/);
});
