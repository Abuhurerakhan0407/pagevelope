import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const studio = readFileSync(new URL("../../apps/web/app/builder/motion/motion-studio.tsx", import.meta.url), "utf8");
const launcher = readFileSync(new URL("../../apps/web/app/builder/motion-launcher.tsx", import.meta.url), "utf8");

test("Motion Studio edits the persisted CampaignDocument rather than generating freeform HTML", () => {
  assert.match(studio, /validateCampaignDocument/);
  assert.match(studio, /replaceTargetImage/);
  assert.match(studio, /\/versions/);
  assert.match(studio, /expectedVersion: version/);
  assert.doesNotMatch(studio, /innerHTML|contentEditable/);
});

test("safe motion requires separate GIF and first-frame evidence with hard payload bounds", () => {
  assert.match(studio, /gifSrc === firstFrameSrc/);
  assert.match(studio, /bytes > 5_000_000/);
  assert.match(studio, /frames < 2/);
  assert.match(studio, /loop: true/);
  assert.match(studio, /firstFrameSrc/);
});

test("removing motion promotes the proven first frame to the production image", () => {
  assert.match(studio, /src: currentMotion\.firstFrameSrc/);
  assert.match(studio, /Motion removed\. The proven first frame is now the static production image/);
});

test("persisted builder campaigns expose Motion Studio without replacing the release workflow", () => {
  assert.match(launcher, /\/builder\/motion/);
  assert.match(launcher, /workspaceId/);
  assert.match(launcher, /campaignId/);
  assert.match(launcher, /GIF \+ Outlook first-frame proof/);
});
