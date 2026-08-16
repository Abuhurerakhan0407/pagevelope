import type { CampaignBlock, CampaignDocumentV1, ImageValue } from "../../editor-schema/src/model.js";

export interface MotionEvidenceItem {
  blockId: string;
  target: string;
  gifSrc: string;
  firstFrameSrc: string;
  previewVideoSrc?: string;
  byteSize: number;
  frameCount: number;
  durationMs: number;
  loop: true;
}

export interface MotionEvidenceSummary {
  count: number;
  totalBytes: number;
  totalFrames: number;
  longestDurationMs: number;
  items: MotionEvidenceItem[];
}

function evidenceForImage(
  image: ImageValue | undefined,
  blockId: string,
  target: string,
): MotionEvidenceItem | null {
  if (!image?.motion) return null;

  return {
    blockId,
    target,
    gifSrc: image.src,
    firstFrameSrc: image.motion.firstFrameSrc,
    previewVideoSrc: image.motion.previewVideoSrc,
    byteSize: image.motion.byteSize,
    frameCount: image.motion.frameCount,
    durationMs: image.motion.durationMs,
    loop: true,
  };
}

function collectBlock(block: CampaignBlock, items: MotionEvidenceItem[]): void {
  if (block.type === "header") {
    const item = evidenceForImage(block.logo, block.id, "header.logo");
    if (item) items.push(item);
    return;
  }

  if (block.type === "hero") {
    const item = evidenceForImage(block.image, block.id, "hero.image");
    if (item) items.push(item);
    return;
  }

  if (block.type === "image") {
    const item = evidenceForImage(block.image, block.id, "image.image");
    if (item) items.push(item);
    return;
  }

  if (block.type === "product-grid") {
    block.products.forEach((product) => {
      const item = evidenceForImage(product.image, block.id, `product-grid.products.${product.id}.image`);
      if (item) items.push(item);
    });
    return;
  }

  if (block.type === "columns") {
    block.columns.forEach((column) => {
      column.blocks.forEach((child) => collectBlock(child, items));
    });
  }
}

export function collectMotionEvidence(campaign: CampaignDocumentV1): MotionEvidenceSummary {
  const items: MotionEvidenceItem[] = [];
  campaign.blocks.forEach((block) => collectBlock(block, items));

  return {
    count: items.length,
    totalBytes: items.reduce((sum, item) => sum + item.byteSize, 0),
    totalFrames: items.reduce((sum, item) => sum + item.frameCount, 0),
    longestDurationMs: items.reduce((max, item) => Math.max(max, item.durationMs), 0),
    items,
  };
}
