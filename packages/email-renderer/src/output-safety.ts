import type { CampaignDocumentV1 } from "../../editor-schema/src/model.js";

export interface OutputSafetyIssue {
  code: "SCRIPT_TAG" | "JAVASCRIPT_URL" | "EVENT_HANDLER" | "UNSUBSCRIBE_HTML_MISSING" | "UNSUBSCRIBE_TEXT_MISSING" | "LEGAL_TEXT_MISSING";
  message: string;
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
