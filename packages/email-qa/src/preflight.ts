import type { CampaignDocumentV1, CampaignBlock } from "../../editor-schema/src/model.js";

export type QaSeverity = "BLOCK" | "WARN" | "PASS";
export interface QaIssue { code: string; severity: Exclude<QaSeverity, "PASS">; message: string; blockId?: string; }
export interface QaReport { status: QaSeverity; issues: QaIssue[]; }

function walk(blocks: CampaignBlock[], visit: (block: CampaignBlock) => void): void {
  blocks.forEach((block) => {
    visit(block);
    if (block.type === "columns") block.columns.forEach((column) => walk(column.blocks, visit));
  });
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
    if (block.type === "image" && !block.image.decorative && !block.image.alt.trim()) issues.push({ code: "ALT_MISSING", severity: "BLOCK", blockId: block.id, message: "Non-decorative image requires alt text." });
    if (block.type === "hero" && block.image && !block.image.decorative && !block.image.alt.trim()) issues.push({ code: "ALT_MISSING", severity: "BLOCK", blockId: block.id, message: "Hero image requires alt text." });
  });
  if (!footerSeen) issues.push({ code: "FOOTER_MISSING", severity: "BLOCK", message: "Campaign requires a footer with unsubscribe handling." });

  return {
    status: issues.some((issue) => issue.severity === "BLOCK") ? "BLOCK" : issues.some((issue) => issue.severity === "WARN") ? "WARN" : "PASS",
    issues
  };
}
