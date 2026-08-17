import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const path = new URL("../../apps/web/app/builder/page.tsx", import.meta.url);
const source = readFileSync(path, "utf8");

test("product grid preview is data-driven from block state", () => {
  assert.match(source, /previewProducts = block\.products\?\.length \? block\.products : \[\]/);
  assert.match(source, /previewProducts\.length \? previewProducts\.map\(\(product\) =>/);
  assert.match(source, /key=\{product\.id\}/);
  assert.match(source, /product\.imageSrc/);
  assert.match(source, /product\.imageAlt/);
  assert.match(source, /<b>\{product\.title\}<\/b>/);
  assert.match(source, /product\.price \? <small>\{product\.price\}<\/small>/);
});

test("product grid preview has no hardcoded fake product rows", () => {
  assert.doesNotMatch(source, /\[\"One\", \"Two\"\]/);
  assert.doesNotMatch(source, /Product One/);
  assert.doesNotMatch(source, /Product Two/);
});

test("empty product grid shows an explicit empty state, not phantom cards", () => {
  assert.match(source, /No products yet/);
  assert.match(source, /Add products to this grid/);
});

test("hero preview renders the edited imageSrc immediately", () => {
  assert.match(source, /block\.imageSrc\?\.trim\(\) \? \(/);
  assert.match(source, /<img className=\{styles\.heroImage\} src=\{block\.imageSrc\}/);
  assert.match(source, /alt=\{block\.imageAlt \?\? ""\}/);
});

test("standalone image block preview renders the edited imageSrc immediately", () => {
  assert.match(source, /<img className=\{styles\.standaloneImage\} src=\{block\.imageSrc\}/);
});

test("images-off mode preserves meaningful alt text from state", () => {
  assert.match(source, /block\.imageAlt\?\.trim\(\) \? `Image hidden · \$\{block\.imageAlt\}`/);
  assert.match(source, /Alt: \{product\.imageAlt \?\? "featured product"\}/);
});