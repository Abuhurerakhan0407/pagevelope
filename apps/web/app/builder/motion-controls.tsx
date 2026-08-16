"use client";

import type { CampaignBlock, GifMotionValue } from "@pagevelope/editor-schema";
import type { BuilderBlock } from "./build-campaign";
import styles from "./builder.module.css";

function editableImage(block: BuilderBlock) {
  if (block.source?.type === "hero") return block.source.image;
  if (block.source?.type === "image") return block.source.image;
  return undefined;
}

function patchSource(block: BuilderBlock, motion: GifMotionValue | undefined): CampaignBlock | undefined {
  if (block.source?.type === "hero" && block.source.image) return { ...block.source, image: { ...block.source.image, motion } };
  if (block.source?.type === "image") return { ...block.source, image: { ...block.source.image, motion } };
  return block.source;
}

export function MotionControls({ block, onChange }: { block: BuilderBlock; onChange: (patch: Partial<BuilderBlock>) => void }) {
  if (block.kind !== "hero" && block.kind !== "image") return null;
  const image = editableImage(block);
  const motion = image?.motion;
  const enabled = Boolean(motion);

  function updateMotion(patch: Partial<GifMotionValue>) {
    const current: GifMotionValue = motion ?? { kind: "gif", firstFrameSrc: "https://images.example.com/static-first-frame.jpg", byteSize: 1200000, frameCount: 48, durationMs: 4000, loop: true };
    onChange({ source: patchSource(block, { ...current, ...patch }) });
  }

  function toggleMotion() {
    onChange({ source: patchSource(block, enabled ? undefined : { kind: "gif", firstFrameSrc: "https://images.example.com/static-first-frame.jpg", byteSize: 1200000, frameCount: 48, durationMs: 4000, loop: true }) });
  }

  return (
    <div className={styles.propertyGroup}>
      <div className={styles.propertyRow}>
        <span>Safe motion</span>
        <button type="button" onClick={toggleMotion}>{enabled ? "Disable" : "Enable GIF"}</button>
      </div>
      {enabled ? (
        <>
          <label><span>Animated GIF URL</span><input value={image?.src ?? ""} readOnly /></label>
          <label><span>Static first-frame URL</span><input value={motion?.firstFrameSrc ?? ""} onChange={(event) => updateMotion({ firstFrameSrc: event.target.value })} /></label>
          <label><span>Browser preview video URL (optional)</span><input value={motion?.previewVideoSrc ?? ""} onChange={(event) => updateMotion({ previewVideoSrc: event.target.value || undefined })} /></label>
          <label><span>GIF bytes</span><input type="number" min="1" value={motion?.byteSize ?? 1} onChange={(event) => updateMotion({ byteSize: Math.max(1, Number(event.target.value) || 1) })} /></label>
          <label><span>Frames</span><input type="number" min="2" value={motion?.frameCount ?? 2} onChange={(event) => updateMotion({ frameCount: Math.max(2, Number(event.target.value) || 2) })} /></label>
          <label><span>Loop duration (ms)</span><input type="number" min="1" value={motion?.durationMs ?? 1} onChange={(event) => updateMotion({ durationMs: Math.max(1, Number(event.target.value) || 1) })} /></label>
          <div className={styles.propertyRow}><span>Fallback contract</span><span>{motion?.firstFrameSrc && motion.firstFrameSrc !== image?.src ? "Static frame ready" : "Needs separate static frame"}</span></div>
          <div className={styles.propertyRow}><span>Payload gate</span><span>{(motion?.byteSize ?? 0) > 5000000 ? "BLOCK > 5 MB" : (motion?.byteSize ?? 0) > 2000000 ? "WARN > 2 MB" : "PASS"}</span></div>
        </>
      ) : null}
    </div>
  );
}
