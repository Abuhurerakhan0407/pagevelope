import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { renderCampaignSpike } from "../../.build/core/packages/email-renderer/src/render.js";

const fixture = JSON.parse(await readFile(new URL("../fixtures/product-launch.json", import.meta.url), "utf8"));

test("renderer spike is deterministic", () => {
  const first = renderCampaignSpike(fixture);
  const second = renderCampaignSpike(JSON.parse(JSON.stringify(fixture)));
  assert.equal(first.mjml, second.mjml);
  assert.deepEqual(first.manifest, second.manifest);
});

test("renderer produces Klaviyo unsubscribe link and plain text", () => {
  const result = renderCampaignSpike(fixture);
  assert.match(result.mjml, /\{% unsubscribe_link %\}/);
  assert.match(result.plainText, /Unsubscribe: \{% unsubscribe_link %\}/);
  assert.match(result.plainText, /Hydration, minus the bulk/);
  assert.equal(result.qa.status, "PASS");
});

test("invalid unsafe href is rejected", () => {
  const broken = JSON.parse(JSON.stringify(fixture));
  broken.blocks[2].cta.href = "javascript:alert(1)";
  assert.throws(() => renderCampaignSpike(broken), /Expected https:\/\/ or mailto: URL/);
});

test("duplicate block IDs are rejected", () => {
  const broken = JSON.parse(JSON.stringify(fixture));
  broken.blocks[1].id = broken.blocks[0].id;
  assert.throws(() => renderCampaignSpike(broken), /Block IDs must be unique/);
});
