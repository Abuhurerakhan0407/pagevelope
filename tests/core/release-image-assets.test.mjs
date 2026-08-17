import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { renderCampaignRelease } from "../../.build/core/packages/email-renderer/src/release.js";
import { BLOCKED_IMAGE_HOSTS } from "../../.build/core/packages/email-qa/src/preflight.js";

const fixture = JSON.parse(await readFile(new URL("../fixtures/product-launch.json", import.meta.url), "utf8"));

function withHeroImage(src) {
  const campaign = JSON.parse(JSON.stringify(fixture));
  const hero = campaign.blocks.find((block) => block.type === "hero");
  hero.image = { ...hero.image, src };
  return campaign;
}

function withProductImage(src) {
  const campaign = JSON.parse(JSON.stringify(fixture));
  const grid = campaign.blocks.find((block) => block.type === "product-grid");
  grid.products[0].image = { ...grid.products[0].image, src };
  return campaign;
}

test("preflight blocks every development/placeholder image host for the hero", async () => {
  const hosts = [...BLOCKED_IMAGE_HOSTS].filter((host) => host !== "::1");
  for (const host of hosts) {
    await assert.rejects(
      () => renderCampaignRelease(withHeroImage(`https://${host}/orbit.jpg`)),
      /IMAGE_PLACEHOLDER/,
      `hero image on ${host} must be blocked`,
    );
  }
  await assert.rejects(
    () => renderCampaignRelease(withHeroImage("https://[::1]/orbit.jpg")),
    /IMAGE_PLACEHOLDER/,
    "hero image on ::1 must be blocked",
  );
});

test("preflight blocks example.com subdomains for the hero", async () => {
  for (const host of ["cdn.example.com", "media.example.com", "www.example.com"]) {
    await assert.rejects(
      () => renderCampaignRelease(withHeroImage(`https://${host}/orbit.jpg`)),
      /IMAGE_PLACEHOLDER/,
      `hero image on ${host} must be blocked`,
    );
  }
});

test("preflight blocks placeholder product images", async () => {
  for (const host of ["images.example.com", "localhost", "127.0.0.1"]) {
    await assert.rejects(
      () => renderCampaignRelease(withProductImage(`https://${host}/product.jpg`)),
      /IMAGE_PLACEHOLDER/,
      `product image on ${host} must be blocked`,
    );
  }
});

test("malformed and non-http(s) image URLs are rejected at the release boundary", async () => {
  for (const src of ["not-a-url", "ftp://cdn.northstargoods.in/orbit.jpg", "javascript:alert(1)"]) {
    await assert.rejects(
      () => renderCampaignRelease(withHeroImage(src)),
      /Expected https:\/\/ or mailto: URL/,
      `${src} must be rejected by schema validation before release`,
    );
  }
  await assert.rejects(
    () => renderCampaignRelease(withHeroImage("mailto:images@example.com")),
    /IMAGE_URL_NOT_HTTP/,
    "mailto image src must be rejected by preflight",
  );
});

test("preflight blocks image URLs with embedded credentials", async () => {
  await assert.rejects(
    () => renderCampaignRelease(withHeroImage("https://user:pass@cdn.northstargoods.in/orbit.jpg")),
    /IMAGE_URL_CREDENTIALS/,
  );
});

test("preflight blocks placeholder motion first-frame assets", async () => {
  const campaign = withHeroImage("https://cdn.northstargoods.in/assets/orbit-motion.gif");
  const hero = campaign.blocks.find((block) => block.type === "hero");
  hero.image.motion = {
    kind: "gif",
    firstFrameSrc: "https://images.example.com/orbit-first-frame.jpg",
    byteSize: 1200000,
    frameCount: 48,
    durationMs: 4000,
    loop: true,
  };
  await assert.rejects(() => renderCampaignRelease(campaign), /IMAGE_PLACEHOLDER/);
});

test("valid production HTTPS assets pass release QA", async () => {
  const release = await renderCampaignRelease(fixture);
  assert.equal(release.manifest.qa.status, "PASS");
  assert.ok(release.html.includes("https://cdn.northstargoods.in/assets/orbit.jpg"));
  assert.ok(release.html.includes("https://cdn.northstargoods.in/assets/orbit-lilac.jpg"));
});

test("valid production CDN URLs with paths, ports, and queries are accepted", async () => {
  const release = await renderCampaignRelease(
    withHeroImage("https://cdn.northstargoods.in/assets/orbit.jpg?w=800&fmt=webp"),
  );
  assert.equal(release.manifest.qa.status, "PASS");
});

test("placeholder rejection happens at the release boundary with a fail-closed message", async () => {
  await assert.rejects(
    () => renderCampaignRelease(withHeroImage("https://images.example.com/orbit.jpg")),
    /Release blocked by QA: IMAGE_PLACEHOLDER/,
  );
});

test("release immutability remains intact after asset validation is added", async () => {
  const first = await renderCampaignRelease(fixture);
  const second = await renderCampaignRelease(JSON.parse(JSON.stringify(fixture)));
  assert.deepEqual(first.manifest, second.manifest);
  assert.equal(first.manifest.sourceFingerprint, second.manifest.sourceFingerprint);
  assert.equal(first.files["campaign.html"], second.files["campaign.html"]);
});

const builderSource = readFileSync(new URL("../../apps/web/app/builder/build-campaign.ts", import.meta.url), "utf8");
const builderPage = readFileSync(new URL("../../apps/web/app/builder/page.tsx", import.meta.url), "utf8");
const briefActions = readFileSync(
  new URL("../../apps/web/app/workspaces/[workspaceId]/brands/[brandId]/campaigns/[campaignId]/brief/actions.ts", import.meta.url),
  "utf8",
);
const reviewPage = readFileSync(new URL("../../apps/web/app/review/[candidateId]/page.tsx", import.meta.url), "utf8");

test("builder blocks expose editable image source and alt fields", () => {
  assert.match(builderSource, /imageSrc\?: string/);
  assert.match(builderSource, /imageAlt\?: string/);
  assert.match(builderSource, /products\?: Array</);
});

test("hydration preserves existing image sources into editable fields", () => {
  assert.match(builderSource, /imageSrc: block\.image\?\.src/);
  assert.match(builderSource, /imageAlt: block\.image\?\.alt/);
  assert.match(builderSource, /imageSrc: block\.image\.src/);
  assert.match(builderSource, /imageSrc: product\.image\.src/);
  assert.match(builderSource, /source: block/);
});

test("serialization merges image edits without overwriting untouched source data", () => {
  assert.match(builderSource, /block\.imageSrc \?\? source\?\.image\?\.src/);
  assert.match(builderSource, /block\.imageAlt \?\? source\?\.image\?\.alt/);
  assert.match(builderSource, /editedProduct\.imageSrc \?\? original\?\.image\.src/);
  assert.match(builderSource, /product\.id === editedProduct\.id/);
});

test("builder no longer fabricates placeholder hero images for untouched blocks", () => {
  assert.match(builderSource, /image: image\?\.src \? image : undefined/);
  assert.doesNotMatch(builderSource, /image: source\?\.image \?\? \{\n\s+src: "https:\/\/images\.example\.com\/orbit\.jpg/);
});

test("builder UI exposes image URL and alt controls for hero and image blocks", () => {
  assert.match(builderPage, /selected\.kind === "hero" \|\| selected\.kind === "image"/);
  assert.match(builderPage, /updateSelected\(\{ imageSrc: event\.target\.value \}\)/);
  assert.match(builderPage, /updateSelected\(\{ imageAlt, body: `Alt text: \$\{imageAlt\}` \}\)/);
  assert.match(builderPage, /isPlaceholderImageUrl\(selected\.imageSrc\)/);
});

test("builder UI exposes per-product image editing while preserving product metadata", () => {
  assert.match(builderPage, /updateProductImage\(index, "imageSrc"/);
  assert.match(builderPage, /updateProductImage\(index, "imageAlt"/);
  assert.match(builderPage, /product\.title/);
  assert.match(builderPage, /product\.price/);
});

test("brief seed no longer fabricates placeholder image URLs", () => {
  assert.doesNotMatch(briefActions, /images\.example\.com/);
  assert.doesNotMatch(briefActions, /product-placeholder\.jpg/);
  assert.match(briefActions, /product-images-required/);
  assert.match(briefActions, /image: leadImage/);
});

test("release review resolves brandId server-side for the back-to-builder link", () => {
  assert.match(reviewPage, /from\("campaigns"\)/);
  assert.match(reviewPage, /select\("id,brand_id"\)/);
  assert.match(reviewPage, /builderQuery\.set\("brandId", brandId\)/);
  assert.match(reviewPage, /const builderUrl = `\/builder\?\$\{builderQuery\.toString\(\)\}`/);
});

test("motion studio back link carries the resolved brandId", () => {
  const motionStudio = readFileSync(new URL("../../apps/web/app/builder/motion/motion-studio.tsx", import.meta.url), "utf8");
  assert.match(motionStudio, /brandId=\$\{encodeURIComponent\(brandId\)\}/);
});