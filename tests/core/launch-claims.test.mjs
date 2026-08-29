import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sources = [
  "layout.tsx",
  "page.tsx",
  "pricing/page.tsx",
  "features/page.tsx",
  "templates/page.tsx",
  "faq/page.tsx",
  "terms/page.tsx",
  "privacy/page.tsx",
  "refund/page.tsx",
  "security/page.tsx",
].map((path) => readFileSync(new URL(`../../apps/web/app/(marketing)/${path}`, import.meta.url), "utf8"));

test("marketing does not advertise free access or an unimplemented trial", () => {
  for (const source of sources) {
    assert.doesNotMatch(source, /start free|try .* free|free trial|no credit card required/i);
  }
});

test("marketing does not claim automated inbox rendering or bulk sending", () => {
  for (const source of sources) {
    assert.doesNotMatch(source, /see exactly how .* renders across|inbox lab detects|send to your lists/i);
  }
});

test("legal pages do not retain stale or unsupported trust claims", () => {
  for (const source of sources) {
    assert.doesNotMatch(source, /January 1, 2024|14-day refund|regularly audit our infrastructure|all data is encrypted/i);
  }
});
