import test from "node:test";
import assert from "node:assert/strict";
import { renderCampaignRelease } from "../../.build/core/packages/email-renderer/src/release.js";
import { assertSafeCompiledOutput } from "../../.build/core/packages/email-renderer/src/output-safety.js";
import { campaignFixtures } from "../fixtures/campaign-matrix.mjs";

function stripImages(html) {
  return html.replace(/<img\b[^>]*>/gi, "");
}

test("hardening matrix contains exactly twenty production campaign fixtures", () => {
  assert.equal(campaignFixtures.length, 20);
  assert.equal(new Set(campaignFixtures.map((campaign) => campaign.id)).size, 20);
});

test("twenty campaign fixtures release deterministically and preserve images-off essentials", async () => {
  for (const campaign of campaignFixtures) {
    const first = await renderCampaignRelease(campaign);
    const second = await renderCampaignRelease(structuredClone(campaign));

    assert.equal(first.manifest.rendererVersion, "0.2.0", campaign.id);
    assert.equal(first.manifest.qa.status, "PASS", campaign.id);
    assert.equal(first.html, second.html, campaign.id);
    assert.equal(first.files["source.json"], second.files["source.json"], campaign.id);
    assert.deepEqual(first.manifest, second.manifest, campaign.id);

    assert.doesNotMatch(first.html, /<script\b/i, campaign.id);
    assert.doesNotMatch(first.html, /javascript\s*:/i, campaign.id);
    assert.doesNotMatch(first.html, /\son[a-z]+\s*=/i, campaign.id);
    assert.match(first.html, /\{% unsubscribe_link %\}/, campaign.id);
    assert.match(first.plainText, /Unsubscribe: \{% unsubscribe_link %\}/, campaign.id);

    const hero = campaign.blocks.find((block) => block.type === "hero");
    const footer = campaign.blocks.find((block) => block.type === "footer");
    const imagesOff = stripImages(first.html);

    assert.ok(hero && imagesOff.includes(hero.heading), `${campaign.id}: hero heading must survive images-off mode`);
    assert.ok(imagesOff.includes("Shop Orbit"), `${campaign.id}: primary CTA text must survive images-off mode`);
    assert.ok(footer && first.plainText.includes(footer.companyName), `${campaign.id}: company name missing from plain text`);
    assert.ok(footer && first.plainText.includes(footer.physicalAddress), `${campaign.id}: physical address missing from plain text`);

    assert.equal(first.manifest.files.length, 4, campaign.id);
    first.manifest.files.forEach((file) => assert.equal(file.sha256.length, 64, `${campaign.id}:${file.name}`));
  }
});

test("user-authored markup is escaped instead of becoming executable HTML", async () => {
  const campaign = structuredClone(campaignFixtures[0]);
  const hero = campaign.blocks.find((block) => block.type === "hero");
  hero.heading = `<script>alert("pagevelope")</script> Safe heading`;

  const release = await renderCampaignRelease(campaign);
  assert.doesNotMatch(release.html, /<script\b/i);
  assert.match(release.html, /Safe heading/);
});

test("compiled output safety fails closed on executable markup", () => {
  const campaign = campaignFixtures[0];
  const footer = campaign.blocks.find((block) => block.type === "footer");
  const legalText = `${footer.companyName}\n${footer.physicalAddress}\nUnsubscribe: {% unsubscribe_link %}`;

  assert.throws(
    () => assertSafeCompiledOutput(campaign, `<html><body><script>alert(1)</script><a href="{% unsubscribe_link %}">Unsubscribe</a></body></html>`, legalText),
    /SCRIPT_TAG/
  );
  assert.throws(
    () => assertSafeCompiledOutput(campaign, `<html><body><a href="javascript:alert(1)">bad</a><a href="{% unsubscribe_link %}">Unsubscribe</a></body></html>`, legalText),
    /JAVASCRIPT_URL/
  );
  assert.throws(
    () => assertSafeCompiledOutput(campaign, `<html><body><a href="{% unsubscribe_link %}" onclick="alert(1)">Unsubscribe</a></body></html>`, legalText),
    /EVENT_HANDLER/
  );
});

test("compiled output safety blocks missing unsubscribe and legal text", () => {
  const campaign = campaignFixtures[0];
  assert.throws(
    () => assertSafeCompiledOutput(campaign, "<html><body>Campaign</body></html>", "Campaign"),
    /UNSUBSCRIBE_HTML_MISSING/
  );
});
