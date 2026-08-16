import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const studio = readFileSync(
  new URL("../../apps/web/app/builder/motion/motion-studio.tsx", import.meta.url),
  "utf8",
);

test("Motion Studio uploads recipient-safe assets instead of asking for manual motion evidence", () => {
  assert.ok(studio.includes('import { inspectGif, uploadDeliveryAsset } from "@/lib/assets/delivery"'));
  assert.ok(studio.includes('accept="image/gif"'));
  assert.ok(studio.includes('accept="image/jpeg,image/png,image/webp"'));
  assert.ok(studio.includes('accept="video/mp4"'));
  assert.ok(studio.includes('await inspectGif(file)'));
  assert.ok(studio.includes('await uploadDeliveryAsset({ workspaceId, brandId, file })'));
});

test("Motion Studio derives immutable release evidence from uploaded GIF bytes", () => {
  assert.ok(studio.includes('byteSize: String(asset.byteSize)'));
  assert.ok(studio.includes('frameCount: String(inspection.frameCount)'));
  assert.ok(studio.includes('durationMs: String(inspection.durationMs)'));
  assert.ok(studio.includes('Animated GIF is above Pagevelope\'s 5 MB release block'));
  assert.ok(studio.includes('readOnly value={form.byteSize}'));
  assert.ok(studio.includes('readOnly value={form.frameCount}'));
  assert.ok(studio.includes('readOnly value={form.durationMs}'));
});
