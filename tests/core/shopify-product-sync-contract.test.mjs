import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = readFileSync(new URL("../../apps/web/lib/shopify/config.ts", import.meta.url), "utf8");
const oauth = readFileSync(new URL("../../apps/web/lib/shopify/oauth.ts", import.meta.url), "utf8");
const client = readFileSync(new URL("../../apps/web/lib/shopify/client.ts", import.meta.url), "utf8");
const start = readFileSync(new URL("../../apps/web/app/api/integrations/shopify/start/route.ts", import.meta.url), "utf8");
const callback = readFileSync(new URL("../../apps/web/app/api/integrations/shopify/callback/route.ts", import.meta.url), "utf8");
const sync = readFileSync(new URL("../../apps/web/app/api/integrations/shopify/sync-products/route.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../supabase/migrations/20260816230600_shopify_product_sync.sql", import.meta.url), "utf8");

const normalized = migration.replace(/--.*$/gm, "").replace(/\s+/g, " ").toLowerCase();

test("Shopify uses the current pinned Admin GraphQL API and read-only product scope", () => {
  assert.match(config, /SHOPIFY_ADMIN_API_VERSION = "2026-07"/);
  assert.match(config, /SHOPIFY_OAUTH_SCOPES = \["read_products"\]/);
  assert.doesNotMatch(config, /write_products|write_orders|read_customers/);
  assert.match(client, /\/admin\/api\/\$\{SHOPIFY_ADMIN_API_VERSION\}\/graphql\.json/);
  assert.match(client, /X-Shopify-Access-Token/);
});

test("standalone OAuth uses state, callback HMAC verification and strict myshopify host validation", () => {
  assert.match(config, /\.myshopify\\\.com/);
  assert.match(oauth, /\/admin\/oauth\/authorize/);
  assert.match(oauth, /\/admin\/oauth\/access_token/);
  assert.match(oauth, /createHmac\("sha256"/);
  assert.match(oauth, /timingSafeEqual/);
  assert.match(start, /createShopifyState/);
  assert.match(callback, /verifyShopifyOAuthHmac/);
  assert.match(callback, /oauth\.state !== returnedState/);
});

test("Shopify credentials remain encrypted and unavailable to browser roles", () => {
  assert.match(callback, /encryptIntegrationSecret\(token\.access_token/);
  assert.match(callback, /integration_credentials_secure/);
  assert.match(callback, /refresh_token_ciphertext: null/);
  assert.match(callback, /access_expires_at: null/);
});

test("product reader imports structured catalog fields without write scopes", () => {
  for (const field of ["title", "handle", "updatedAt", "onlineStoreUrl", "featuredMedia", "variants(first: 1)"]) {
    assert.ok(client.includes(field));
  }
  assert.match(client, /shop \{ currencyCode \}/);
  assert.doesNotMatch(client, /mutation\s/i);
});

test("tenant RPC upserts Shopify products and preserves manual catalog rows", () => {
  assert.match(normalized, /create or replace function public\.upsert_shopify_product/);
  assert.match(normalized, /private\.can_edit_workspace\(target_workspace_id\)/);
  assert.match(normalized, /source = 'shopify'::public\.product_source/);
  assert.match(normalized, /on conflict \(workspace_id, brand_id, external_id\)/);
  assert.match(normalized, /product\.synced\.shopify/);
  assert.doesNotMatch(normalized, /delete from public\.products/);
});

test("sync endpoint is authenticated, tenant/brand scoped, paginated and uses the audited RPC", () => {
  assert.match(sync, /auth\.getClaims/);
  assert.match(sync, /workspace_memberships/);
  assert.match(sync, /brands/);
  assert.match(sync, /fetchShopifyProductPage/);
  assert.match(sync, /upsert_shopify_product/);
  assert.match(sync, /nextCursor/);
  assert.match(sync, /hasNextPage/);
});
