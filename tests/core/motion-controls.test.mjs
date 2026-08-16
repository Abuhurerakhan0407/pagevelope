import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const controls = readFileSync(new URL("../../apps/web/app/builder/motion-controls.tsx", import.meta.url), "utf8");

test("Motion Studio exposes constrained GIF metadata and static fallback controls", () => {
  assert.match(controls, /Safe motion/);
  assert.match(controls, /Animated GIF URL/);
  assert.match(controls, /Static first-frame URL/);
  assert.match(controls, /Browser preview video URL/);
  assert.match(controls, /GIF bytes/);
  assert.match(controls, /Frames/);
  assert.match(controls, /Loop duration/);
  assert.match(controls, /BLOCK > 5 MB/);
  assert.match(controls, /WARN > 2 MB/);
});

test("Motion Studio only patches hero or image schema sources", () => {
  assert.match(controls, /block\.source\?\.type === "hero"/);
  assert.match(controls, /block\.source\?\.type === "image"/);
  assert.match(controls, /kind: "gif"/);
  assert.match(controls, /loop: true/);
});
