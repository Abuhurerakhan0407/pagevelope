import type { CampaignBlock, CampaignDocumentV1 } from "../../editor-schema/src/model.js";

function blockToText(block: CampaignBlock): string[] {
  switch (block.type) {
    case "preheader": return [];
    case "header": return [block.wordmark ?? ""];
    case "hero": return [block.eyebrow ?? "", block.heading, block.body ?? "", block.cta ? `${block.cta.label}: ${block.cta.href}` : ""];
    case "text": return [block.heading ?? "", block.body];
    case "image": return block.href ? [`${block.image.alt}: ${block.href}`] : [block.image.alt];
    case "button": return [`${block.cta.label}: ${block.cta.href}`];
    case "divider": return ["---"];
    case "spacer": return [];
    case "social": return block.links.map((link) => `${link.label}: ${link.href}`);
    case "product-grid": return [block.heading ?? "", ...block.products.flatMap((product) => [product.title, product.price ?? "", product.href])];
    case "columns": return block.columns.flatMap((column) => column.blocks.flatMap(blockToText));
    case "footer": return [block.companyName, block.physicalAddress, block.websiteUrl ?? "", block.privacyUrl ?? "", "Unsubscribe: {% unsubscribe_link %}"];
  }
}

export function campaignToPlainText(campaign: CampaignDocumentV1): string {
  return campaign.blocks.flatMap(blockToText).map((line) => line.trim()).filter(Boolean).join("\n\n");
}
