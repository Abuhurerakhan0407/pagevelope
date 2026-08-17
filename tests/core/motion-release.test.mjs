import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { renderCampaignRelease } from "../../.build/core/packages/email-renderer/src/release.js";

const fixture = JSON.parse(await readFile(new URL("../fixtures/product-launch.json", import.meta.url), "utf8"));

function withHeroMotion(overrides = {}) {
  const campaign = JSON.parse(JSON.stringify(fixture));
  const hero = campaign.blocks.find((block) => block.type === "hero");
  hero.image = {
    ...hero.image,
    src: "https://cdn.northstargoods.in/assets/orbit-motion.gif",
    motion: {
      kind: "gif",
      firstFrameSrc: "https://cdn.northstargoods.in/assets/orbit-first-frame.jpg",
      previewVideoSrc: "https://cdn.northstargoods.in/assets/orbit-preview.mp4",
      byteSize: 1200000,
      frameCount: 48,
      durationMs: 4000,
      loop: true,
      ...overrides,
    },
  };
  return campaign;
}

test("safe motion release contains animated GIF, explicit Outlook fallback, and manifest evidence", async () => {
  const release = await renderCampaignRelease(withHeroMotion());

  assert.match(release.mjml, /\[if mso\]/i);
  assert.match(release.mjml, /\[if !mso\]/i);
  assert.ok(release.html.includes("https://cdn.northstargoods.in/assets/orbit-motion.gif"));
  assert.ok(release.html.includes("https://cdn.northstargoods.in/assets/orbit-first-frame.jpg"));
  assert.equal(release.manifest.motion.count, 1);
  assert.equal(release.manifest.motion.totalBytes, 1200000);
  assert.equal(release.manifest.motion.totalFrames, 48);
  assert.equal(release.manifest.motion.longestDurationMs, 4000);
  assert.deepEqual(release.manifest.motion.items[0], {
    blockId: "hero",
    target: "hero.image",
    gifSrc: "https://cdn.northstargoods.in/assets/orbit-motion.gif",
    firstFrameSrc: "https://cdn.northstargoods.in/assets/orbit-first-frame.jpg",
    previewVideoSrc: "https://cdn.northstargoods.in/assets/orbit-preview.mp4",
    byteSize: 1200000,
    frameCount: 48,
    durationMs: 4000,
    loop: true,
  });
});

test("release fails closed when motion exceeds the hard payload limit", async () => {
  await assert.rejects(
    () => renderCampaignRelease(withHeroMotion({ byteSize: 5000001 })),
    /MOTION_TOO_LARGE/,
  );
});

test("motion requires a separate static first-frame asset", async () => {
  await assert.rejects(
    () => renderCampaignRelease(withHeroMotion({ firstFrameSrc: "https://cdn.northstargoods.in/assets/orbit-motion.gif" })),
    /First-frame fallback must be a separate static asset from the animated GIF/,
  );
});
