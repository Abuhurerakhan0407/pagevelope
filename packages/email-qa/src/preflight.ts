import type { CampaignDocumentV1, CampaignBlock, ImageValue } from "../../editor-schema/src/model.js";

export type QaSeverity = "BLOCK" | "WARN" | "PASS";
export interface QaIssue { code: string; severity: Exclude<QaSeverity, "PASS">; message: string; blockId?: string; }
export interface QaReport { status: QaSeverity; issues: QaIssue[]; }

export const MOTION_WARN_BYTES = 2_000_000;
export const MOTION_BLOCK_BYTES = 5_000_000;
export const MOTION_WARN_DURATION_MS = 15_000;
export const MOTION_WARN_FRAMES = 180;

/**
 * Development/placeholder image hosts are never release-ready. Real production
 * CDN hosts are always allowed; only these known-bad hosts are rejected.
 * Subdomains of example.com are rejected as well.
 */
export const BLOCKED_IMAGE_HOSTS = new Set([
  "example.com",
  "images.example.com",
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
]);

function walk(blocks: CampaignBlock[], visit: (block: CampaignBlock) => void): void {
  blocks.forEach((block) => {
    visit(block);
    if (block.type === "columns") block.columns.forEach((column) => walk(column.blocks, visit));
  });
}

/**
 * A release-ready image must be an http(s) URL on a real production host.
 * Placeholders, local hosts, malformed URLs, non-http(s) schemes and embedded
 * credentials can never become release evidence.
 */
function inspectImageUrl(url: string, path: string, blockId: string, issues: QaIssue[]): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    issues.push({ code: "IMAGE_URL_INVALID", severity: "BLOCK", blockId, message: `${path} is not a valid URL.` });
    return;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    issues.push({
      code: "IMAGE_URL_NOT_HTTP",
      severity: "BLOCK",
      blockId,
      message: `${path} must use http(s).`,
    });
    return;
  }

  if (parsed.username || parsed.password) {
    issues.push({
      code: "IMAGE_URL_CREDENTIALS",
      severity: "BLOCK",
      blockId,
      message: `${path} must not embed credentials.`,
    });
    return;
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/^www\./, "");
  if (BLOCKED_IMAGE_HOSTS.has(host) || host.endsWith(".example.com")) {
    issues.push({
      code: "IMAGE_PLACEHOLDER",
      severity: "BLOCK",
      blockId,
      message: `${path} points at development/placeholder host "${parsed.hostname}"; replace it with a production asset URL.`,
    });
  }
}

function inspectImage(image: ImageValue | undefined, path: string, blockId: string, issues: QaIssue[]): void {
  if (!image) return;
  inspectImageUrl(image.src, `${path}.src`, blockId, issues);
  if (image.motion) {
    inspectImageUrl(image.motion.firstFrameSrc, `${path}.motion.firstFrameSrc`, blockId, issues);
    if (image.motion.previewVideoSrc) inspectImageUrl(image.motion.previewVideoSrc, `${path}.motion.previewVideoSrc`, blockId, issues);
  }
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
    if (block.type === "header") {
      inspectImage(block.logo, "header.logo", block.id, issues);
      inspectMotion(block.logo, block.id, issues);
    }
    if (block.type === "image") {
      inspectImage(block.image, "image.image", block.id, issues);
      if (!block.image.decorative && !block.image.alt.trim()) issues.push({ code: "ALT_MISSING", severity: "BLOCK", blockId: block.id, message: "Non-decorative image requires alt text." });
      inspectMotion(block.image, block.id, issues);
    }
    if (block.type === "hero" && block.image) {
      inspectImage(block.image, "hero.image", block.id, issues);
      if (!block.image.decorative && !block.image.alt.trim()) issues.push({ code: "ALT_MISSING", severity: "BLOCK", blockId: block.id, message: "Hero image requires alt text." });
      inspectMotion(block.image, block.id, issues);
    }
    if (block.type === "product-grid") {
      block.products.forEach((product, index) => {
        inspectImage(product.image, `product-grid.products[${index}].image`, block.id, issues);
        inspectMotion(product.image, block.id, issues);
      });
    }
  });
  if (!footerSeen) issues.push({ code: "FOOTER_MISSING", severity: "BLOCK", message: "Campaign requires a footer with unsubscribe handling." });

  return {
    status: issues.some((issue) => issue.severity === "BLOCK") ? "BLOCK" : issues.some((issue) => issue.severity === "WARN") ? "WARN" : "PASS",
    issues
  };
}
