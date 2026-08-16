import type { CampaignDocumentV1, CampaignBlock, ImageValue } from "../../editor-schema/src/model.js";

export type QaSeverity = "BLOCK" | "WARN" | "PASS";
export interface QaIssue { code: string; severity: Exclude<QaSeverity, "PASS">; message: string; blockId?: string; }
export interface QaReport { status: QaSeverity; issues: QaIssue[]; }

export const MOTION_WARN_BYTES = 2_000_000;
export const MOTION_BLOCK_BYTES = 5_000_000;
export const MOTION_WARN_DURATION_MS = 15_000;
export const MOTION_WARN_FRAMES = 180;

function walk(blocks: CampaignBlock[], visit: (block: CampaignBlock) => void): void {
  blocks.forEach((block) => {
    visit(block);
    if (block.type === "columns") block.columns.forEach((column) => walk(column.blocks, visit));
  });
}

function inspectMotion(image: ImageValue | undefined, blockId: string, issues: QaIssue[]): void {
  const motion = image?.motion;
  if (!motion) return;

  if (motion.byteSize > MOTION_BLOCK_BYTES) {
    issues.push({
      code: "MOTION_TOO_LARGE",
      severity: "BLOCK",
      blockId,
      message: `Animated GIF is ${motion.byteSize} bytes; Pagevelope blocks motion above ${MOTION_BLOCK_BYTES} bytes.`
    });
  } else if (motion.byteSize > MOTION_WARN_BYTES) {
    issues.push({
      code: "MOTION_HEAVY",
      severity: "WARN",
      blockId,
      message: `Animated GIF is ${motion.byteSize} bytes; optimize it below ${MOTION_WARN_BYTES} bytes when possible.`
    });
  }

  if (motion.durationMs > MOTION_WARN_DURATION_MS) {
    issues.push({
      code: "MOTION_LONG",
      severity: "WARN",
      blockId,
      message: `Motion loop runs ${motion.durationMs}ms; shorter loops are preferred for campaign attention.`
    });
  }

  if (motion.frameCount > MOTION_WARN_FRAMES) {
    issues.push({
      code: "MOTION_FRAME_HEAVY",
      severity: "WARN",
      blockId,
      message: `Motion uses ${motion.frameCount} frames; reduce frame count before release when possible.`
    });
  }
}

export function runPreflight(campaign: CampaignDocumentV1): QaReport {
  const issues: QaIssue[] = [];
  if (campaign.subject.length > 70) issues.push({ code: "SUBJECT_LONG", severity: "WARN", message: "Subject exceeds 70 characters." });
  if (campaign.preheader.length > 120) issues.push({ code: "PREHEADER_LONG", severity: "WARN", message: "Preheader exceeds 120 characters." });

  let footerSeen = false;
  walk(campaign.blocks, (block) => {
    if (block.type === "footer") {
      footerSeen = true;
      if (!block.physicalAddress.trim()) issues.push({ code: "ADDRESS_MISSING", severity: "BLOCK", blockId: block.id, message: "Physical business address is required." });
    }
    if (block.type === "header") inspectMotion(block.logo, block.id, issues);
    if (block.type === "image") {
      if (!block.image.decorative && !block.image.alt.trim()) issues.push({ code: "ALT_MISSING", severity: "BLOCK", blockId: block.id, message: "Non-decorative image requires alt text." });
      inspectMotion(block.image, block.id, issues);
    }
    if (block.type === "hero" && block.image) {
      if (!block.image.decorative && !block.image.alt.trim()) issues.push({ code: "ALT_MISSING", severity: "BLOCK", blockId: block.id, message: "Hero image requires alt text." });
      inspectMotion(block.image, block.id, issues);
    }
    if (block.type === "product-grid") {
      block.products.forEach((product) => inspectMotion(product.image, block.id, issues));
    }
  });
  if (!footerSeen) issues.push({ code: "FOOTER_MISSING", severity: "BLOCK", message: "Campaign requires a footer with unsubscribe handling." });

  return {
    status: issues.some((issue) => issue.severity === "BLOCK") ? "BLOCK" : issues.some((issue) => issue.severity === "WARN") ? "WARN" : "PASS",
    issues
  };
}
