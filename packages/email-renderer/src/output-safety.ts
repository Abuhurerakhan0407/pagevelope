import type { CampaignBlock, CampaignDocumentV1, ImageValue } from "../../editor-schema/src/model.js";

export interface OutputSafetyIssue {
  code:
    | "SCRIPT_TAG"
    | "JAVASCRIPT_URL"
    | "EVENT_HANDLER"
    | "UNSUBSCRIBE_HTML_MISSING"
    | "UNSUBSCRIBE_TEXT_MISSING"
    | "LEGAL_TEXT_MISSING"
    | "MOTION_GIF_MISSING"
    | "MOTION_FALLBACK_MISSING";
  message: string;
}

function htmlContainsUrl(html: string, url: string): boolean {
  return html.includes(url) || html.includes(url.replaceAll("&", "&amp;"));
}

function inspectMotionImage(image: ImageValue | undefined, html: string, issues: OutputSafetyIssue[]): void {
  if (!image?.motion) return;

  if (!htmlContainsUrl(html, image.src)) {
    issues.push({
      code: "MOTION_GIF_MISSING",
      message: "Compiled HTML must contain every approved animated GIF asset.",
    });
  }

  if (!htmlContainsUrl(html, image.motion.firstFrameSrc)) {
    issues.push({
      code: "MOTION_FALLBACK_MISSING",
      message: "Compiled HTML must contain every approved static first-frame fallback asset.",
    });
  }
}

function inspectBlockMotion(block: CampaignBlock, html: string, issues: OutputSafetyIssue[]): void {
  if (block.type === "header") {
    inspectMotionImage(block.logo, html, issues);
    return;
  }
  if (block.type === "hero") {
    inspectMotionImage(block.image, html, issues);
    return;
  }
  if (block.type === "image") {
    inspectMotionImage(block.image, html, issues);
    return;
  }
  if (block.type === "product-grid") {
    block.products.forEach((product) => inspectMotionImage(product.image, html, issues));
    return;
  }
  if (block.type === "columns") {
    block.columns.forEach((column) => column.blocks.forEach((child) => inspectBlockMotion(child, html, issues)));
  }
}

export function inspectCompiledOutput(
  campaign: CampaignDocumentV1,
  html: string,
  plainText: string
): OutputSafetyIssue[] {
  const issues: OutputSafetyIssue[] = [];

  if (/<script\b/i.test(html)) {
    issues.push({ code: "SCRIPT_TAG", message: "Compiled HTML must not contain script tags." });
  }
  if (/javascript\s*:/i.test(html)) {
    issues.push({ code: "JAVASCRIPT_URL", message: "Compiled HTML must not contain javascript: URLs." });
  }
  if (/\son[a-z]+\s*=/i.test(html)) {
    issues.push({ code: "EVENT_HANDLER", message: "Compiled HTML must not contain inline event handlers." });
  }
  if (!html.includes("{% unsubscribe_link %}")) {
    issues.push({ code: "UNSUBSCRIBE_HTML_MISSING", message: "Compiled HTML must contain the Klaviyo unsubscribe token." });
  }
  if (!plainText.includes("{% unsubscribe_link %}")) {
    issues.push({ code: "UNSUBSCRIBE_TEXT_MISSING", message: "Plain-text output must contain the Klaviyo unsubscribe token." });
  }

  const footer = campaign.blocks.find((block) => block.type === "footer");
  if (!footer || !plainText.includes(footer.companyName) || !plainText.includes(footer.physicalAddress)) {
    issues.push({ code: "LEGAL_TEXT_MISSING", message: "Plain-text output must preserve company name and physical address." });
  }

  campaign.blocks.forEach((block) => inspectBlockMotion(block, html, issues));

  return issues;
}

export function assertSafeCompiledOutput(
  campaign: CampaignDocumentV1,
  html: string,
  plainText: string
): void {
  const issues = inspectCompiledOutput(campaign, html, plainText);
  if (issues.length === 0) return;
  throw new Error(`Release blocked by output safety: ${issues.map((issue) => `${issue.code}: ${issue.message}`).join("; ")}`);
}
