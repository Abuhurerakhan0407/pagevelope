import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const panel = readFileSync(
  new URL("../../apps/web/app/workspaces/[workspaceId]/brands/[brandId]/campaigns/[campaignId]/products/shopify-panel.tsx", import.meta.url),
  "utf8",
);

test("Shopify pagination keeps the returned cursor while refreshing the server catalog", () => {
  assert.match(panel, /const nextPageCursor = payload\.nextCursor \?\? null/);
  assert.match(panel, /setCursor\(nextPageCursor\)/);
  assert.match(panel, /setHasMore\(morePages\)/);
  assert.match(panel, /router\.refresh\(\)/);
  assert.doesNotMatch(panel, /window\.location\.reload/);
});

test("the next sync request sends the prior cursor instead of restarting page one", () => {
  assert.match(panel, /body: JSON\.stringify\(\{ workspaceId, brandId, cursor: nextCursor \}\)/);
  assert.match(panel, /syncProducts\(hasMore \? cursor : null\)/);
  assert.match(panel, /Sync next 50 products/);
});
