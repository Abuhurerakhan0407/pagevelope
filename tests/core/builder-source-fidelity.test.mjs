import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const path = new URL("../../apps/web/app/builder/build-campaign.ts", import.meta.url);
const source = readFileSync(path, "utf8");

test("hydrated builder blocks retain their schema-valid source block", () => {
  assert.match(source, /source\?: CampaignBlock/);
  for (const type of ["header", "hero", "text", "image", "button", "product-grid", "divider", "spacer", "social", "footer"]) {
    const escaped = type.replace("-", "\\-");
    assert.match(source, new RegExp(`sourceOfType\\(block, \"${escaped}\"\\)`));
  }
});

test("product grids preserve selected product ids, images, prices, and hrefs after hydration", () => {
  assert.match(source, /source\?\.products \?\? \[/);
  assert.match(source, /source: block/);
  assert.match(source, /block\.products\.map/);
  assert.match(source, /editedProduct\.imageSrc \?\? original\?\.image\.src/);
});

test("hero and button edits keep the original production destination", () => {
  assert.match(source, /href: source\?\.cta\?\.href \?\? productUrl\(context\)/);
  assert.match(source, /href: source\?\.cta\.href \?\? productUrl\(context\)/);
  assert.match(source, /imageEdited/);
  assert.match(source, /image: image\?\.src \? image : undefined/);
});

test("footer production links survive visual text edits", () => {
  assert.match(source, /websiteUrl: source\?\.websiteUrl \?\? homeUrl\(context\)/);
  assert.match(source, /privacyUrl: source\?\.privacyUrl \?\?/);
});
