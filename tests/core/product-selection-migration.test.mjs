import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL("../../supabase/migrations/20260816210000_product_selection.sql", import.meta.url);
const sql = readFileSync(migrationPath, "utf8");
const normalized = sql.replace(/--.*$/gm, "").replace(/\s+/g, " ").trim().toLowerCase();

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
