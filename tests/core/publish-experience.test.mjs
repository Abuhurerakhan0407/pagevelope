import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../../apps/web/app/publish/[candidateId]/page.tsx", import.meta.url), "utf8");
const client = readFileSync(new URL("../../apps/web/app/publish/[candidateId]/publish-client.tsx", import.meta.url), "utf8");
const reviewActions = readFileSync(new URL("../../apps/web/app/review/[candidateId]/actions.ts", import.meta.url), "utf8");

test("final approval routes to a separate human publish workspace", () => {
  assert.match(reviewActions, /publishPath\(workspaceId, candidateId\)/);
  assert.match(reviewActions, /redirect\(publishPath\(workspaceId, candidateId\)\)/);
  assert.match(page, /Human publish action|Release handoff/);
});

test("publish UI fails closed on approval, connection, and server configuration", () => {
  assert.match(page, /campaign\.status === "approved"/);
  assert.match(page, /campaign\.current_version_number === candidate\.version_number/);
  assert.match(page, /connection\?\.status === "connected"/);
  assert.match(page, /getKlaviyoServerConfig/);
  assert.match(page, /canPublish/);
});

test("Klaviyo publishing requires an explicit user click and never triggers a send job", () => {
  assert.match(client, /onClick=\{publish\}/);
  assert.match(client, /Publish to Klaviyo/);
  assert.match(client, /campaignMessageId/);
  assert.doesNotMatch(client, /campaign-send-jobs/);
  assert.match(page, /does not call Klaviyo&amp;apos;s campaign-send endpoint|does not call Klaviyo/);
});

test("published releases render an immutable receipt instead of another publish button", () => {
  assert.match(page, /campaign_publish_receipts/);
  assert.match(page, /Immutable release receipt/);
  assert.match(page, /receipt \? \(/);
  assert.match(page, /canPublish \? \(/);
});
