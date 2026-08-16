import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const launcher = readFileSync(new URL("../../apps/web/app/builder/review-launcher.tsx", import.meta.url), "utf8");
const normalizer = readFileSync(new URL("../../apps/web/app/builder/route-normalizer.tsx", import.meta.url), "utf8");
const layout = readFileSync(new URL("../../apps/web/app/builder/layout.tsx", import.meta.url), "utf8");
const latestRoute = readFileSync(new URL("../../apps/web/app/api/campaigns/[campaignId]/release-candidates/latest/route.ts", import.meta.url), "utf8");

test("builder starts review from the server-created persisted release candidate", () => {
  assert.match(launcher, /release-candidates`/);
  assert.match(launcher, /method: "POST"/);
  assert.match(launcher, /JSON\.stringify\(\{ workspaceId \}\)/);
  assert.match(launcher, /router\.push\(`\/review\//);
});

test("existing immutable candidate is reopened instead of duplicated", () => {
  assert.match(launcher, /CANDIDATE_EXISTS/);
  assert.match(launcher, /release-candidates\/latest/);
  assert.match(latestRoute, /eq\("version_number", campaign\.current_version_number\)/);
});

test("builder route normalizer restores persisted mode when a return link lacks brandId", () => {
  assert.match(normalizer, /payload\.campaign\?\.brand_id/);
  assert.match(normalizer, /next\.set\("brandId", resolvedBrandId\)/);
  assert.match(normalizer, /router\.replace\(`\/builder\?/);
});

test("search-param client helpers are isolated behind suspense boundaries", () => {
  assert.match(layout, /Suspense/);
  assert.match(layout, /BuilderRouteNormalizer/);
  assert.match(layout, /ReviewLauncher/);
});
