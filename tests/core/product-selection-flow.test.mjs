import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const actionPath = "apps/web/app/workspaces/[workspaceId]/brands/[brandId]/actions.ts";
const brandPagePath = "apps/web/app/workspaces/[workspaceId]/brands/[brandId]/page.tsx";
const briefPagePath = "apps/web/app/workspaces/[workspaceId]/brands/[brandId]/campaigns/[campaignId]/brief/page.tsx";
const briefActionsPath = "apps/web/app/workspaces/[workspaceId]/brands/[brandId]/campaigns/[campaignId]/brief/actions.ts";

const read = (path) => fs.readFileSync(path, "utf8");

test("new campaigns route to product selection before brief", () => {
  const source = read(actionPath);
  assert.match(source, /campaigns\/\$\{encodeURIComponent\(String\(data\)\)\}\/products/);
});

test("brand overview exposes product gate before brief and builder", () => {
  const source = read(brandPagePath);
  assert.match(source, /product_selection_completed_at/);
  assert.match(source, /Select products →/);
  assert.match(source, /if \(!campaign\.product_selection_completed_at\) return `\$\{base\}\/products`/);
});

test("brief page fails closed when product selection is incomplete", () => {
  const source = read(briefPagePath);
  assert.match(source, /if \(!campaign\.product_selection_completed_at\)/);
  assert.match(source, /redirect\(productsPath\(workspaceId, brandId, campaignId\)\)/);
});

test("direction seed uses persisted selected products instead of placeholder product cards", () => {
  const source = read(briefActionsPath);
  assert.match(source, /from\("campaign_products"\)/);
  assert.match(source, /from\("products"\)/);
  assert.match(source, /products: products\.map/);
  assert.doesNotMatch(source, /Featured product one/);
  assert.doesNotMatch(source, /featured-one/);
});
