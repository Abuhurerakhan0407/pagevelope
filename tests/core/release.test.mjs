import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compileMjmlStrict } from "../../.build/core/packages/email-renderer/src/compile.js";
import { renderCampaignRelease } from "../../.build/core/packages/email-renderer/src/release.js";

const fixture = JSON.parse(await readFile(new URL("../fixtures/product-launch.json", import.meta.url), "utf8"));

test("production renderer compiles deterministic MJML into HTML", async () => {
  const first = await renderCampaignRelease(fixture);
  const second = await renderCampaignRelease(JSON.parse(JSON.stringify(fixture)));

  assert.match(first.html, /<html/i);
  assert.match(first.html, /Hydration, minus the bulk/);
  assert.equal(first.manifest.compiler.name, "mjml");
  assert.equal(first.manifest.compiler.version, "5.4.0");
  assert.equal(first.manifest.compiler.validationLevel, "strict");
  assert.deepEqual(first.manifest, second.manifest);
  assert.equal(first.files["campaign.html"], second.files["campaign.html"]);
});

test("release bundle contains canonical source, MJML, HTML, text and manifest", async () => {
  const release = await renderCampaignRelease(fixture);
  assert.ok(release.files["source.json"].length > 0);
  assert.ok(release.files["campaign.mjml"].startsWith("<mjml>"));
  assert.match(release.files["campaign.html"], /<!doctype html>/i);
  assert.match(release.files["campaign.txt"], /Unsubscribe: \{% unsubscribe_link %\}/);
  assert.equal(JSON.parse(release.files["manifest.json"]).campaignId, fixture.id);
  assert.equal(release.manifest.files.length, 4);
  assert.equal(release.manifest.sourceFingerprint.length, 64);
  release.manifest.files.forEach((file) => assert.equal(file.sha256.length, 64));
});

test("release fails closed when QA has a blocking issue", async () => {
  const broken = JSON.parse(JSON.stringify(fixture));
  broken.blocks = broken.blocks.filter((block) => block.type !== "footer");
  await assert.rejects(() => renderCampaignRelease(broken), /Release blocked by QA: FOOTER_MISSING/);
});

test("strict MJML compiler rejects invalid components", async () => {
  await assert.rejects(
    () => compileMjmlStrict("<mjml><mj-body><mj-section><mj-column><mj-not-real /></mj-column></mj-section></mj-body></mjml>"),
    /MJML compilation failed/
  );
});
