import type {
  ButtonBlock,
  CampaignBlock,
  CampaignDocumentV1,
  ColumnChild,
  ColumnsBlock,
  FooterBlock,
  HeroBlock,
  ImageBlock,
  ProductGridBlock,
  SocialBlock,
  TextBlock
} from "../../editor-schema/src/model.js";
import { escapeXml } from "./escape.js";

function attr(value: string): string { return escapeXml(value); }
function align(value: "left" | "center" | "right" | undefined): string { return value ?? "left"; }

function renderText(block: TextBlock): string {
  return `<mj-section padding="8px 0"><mj-column>${block.heading ? `<mj-text padding="8px 24px 4px" font-size="22px" font-weight="700" align="${align(block.align)}">${escapeXml(block.heading)}</mj-text>` : ""}<mj-text padding="6px 24px 14px" line-height="1.6" align="${align(block.align)}">${escapeXml(block.body)}</mj-text></mj-column></mj-section>`;
}

function renderImage(block: ImageBlock): string {
  const image = `<mj-image padding="10px 24px" src="${attr(block.image.src)}" alt="${attr(block.image.alt)}"${block.image.width ? ` width="${block.image.width}px"` : ""} />`;
  return `<mj-section padding="0"><mj-column>${block.href ? `<mj-raw><a href="${attr(block.href)}" style="text-decoration:none"></mj-raw>${image}<mj-raw></a></mj-raw>` : image}</mj-column></mj-section>`;
}

function renderButton(block: ButtonBlock): string {
  return `<mj-section padding="4px 0 16px"><mj-column><mj-button align="${align(block.align)}" href="${attr(block.cta.href)}" background-color="{{PRIMARY_COLOR}}" color="#ffffff" border-radius="8px" padding="6px 24px">${escapeXml(block.cta.label)}</mj-button></mj-column></mj-section>`;
}

function renderHero(block: HeroBlock, primary: string): string {
  const image = block.image ? `<mj-image padding="12px 24px 4px" src="${attr(block.image.src)}" alt="${attr(block.image.alt)}"${block.image.width ? ` width="${block.image.width}px"` : ""} />` : "";
  const eyebrow = block.eyebrow ? `<mj-text padding="28px 24px 6px" color="${primary}" font-size="12px" font-weight="700" text-transform="uppercase" letter-spacing="1px" align="${align(block.align)}">${escapeXml(block.eyebrow)}</mj-text>` : "";
  const body = block.body ? `<mj-text padding="8px 24px 10px" line-height="1.55" align="${align(block.align)}">${escapeXml(block.body)}</mj-text>` : "";
  const cta = block.cta ? `<mj-button align="${align(block.align)}" href="${attr(block.cta.href)}" background-color="${primary}" color="#ffffff" border-radius="8px" padding="8px 24px 30px">${escapeXml(block.cta.label)}</mj-button>` : "";
  return `<mj-section padding="0" background-color="${block.backgroundColor ?? "#ffffff"}"><mj-column>${image}${eyebrow}<mj-text padding="6px 24px" font-size="38px" line-height="1.08" font-weight="750" align="${align(block.align)}">${escapeXml(block.heading)}</mj-text>${body}${cta}</mj-column></mj-section>`;
}

function renderProductGrid(block: ProductGridBlock, primary: string): string {
  const columnWidth = block.columns === 3 ? "33.333%" : block.columns === 1 ? "100%" : "50%";
  const products = block.products.map((product) => `<mj-column width="${columnWidth}" padding="8px"><mj-image padding="0 0 10px" src="${attr(product.image.src)}" alt="${attr(product.image.alt)}" /><mj-text padding="0 0 4px" font-weight="700">${escapeXml(product.title)}</mj-text>${product.price ? `<mj-text padding="0 0 8px" color="#6b7280">${escapeXml(product.price)}</mj-text>` : ""}<mj-button href="${attr(product.href)}" align="left" background-color="${primary}" color="#ffffff" border-radius="7px" padding="4px 0">View product</mj-button></mj-column>`).join("");
  return `${block.heading ? `<mj-section padding="18px 24px 2px"><mj-column><mj-text padding="0" font-size="24px" font-weight="700">${escapeXml(block.heading)}</mj-text></mj-column></mj-section>` : ""}<mj-section padding="8px 16px 20px">${products}</mj-section>`;
}

function renderSocial(block: SocialBlock): string {
  const links = block.links.map((link) => `<mj-text padding="2px 8px" align="center"><a href="${attr(link.href)}" style="color:inherit;text-decoration:underline">${escapeXml(link.label)}</a></mj-text>`).join("");
  return `<mj-section padding="8px 16px"><mj-column>${links}</mj-column></mj-section>`;
}

function renderColumnChild(block: ColumnChild, primary: string): string {
  switch (block.type) {
    case "text": return `${block.heading ? `<mj-text font-size="18px" font-weight="700">${escapeXml(block.heading)}</mj-text>` : ""}<mj-text line-height="1.55">${escapeXml(block.body)}</mj-text>`;
    case "image": return `<mj-image src="${attr(block.image.src)}" alt="${attr(block.image.alt)}" />`;
    case "button": return `<mj-button href="${attr(block.cta.href)}" background-color="${primary}" color="#ffffff" border-radius="7px">${escapeXml(block.cta.label)}</mj-button>`;
  }
}

function renderColumns(block: ColumnsBlock, primary: string): string {
  const columns = block.columns.map((column) => `<mj-column${column.width ? ` width="${column.width}%"` : ""} padding="8px">${column.blocks.map((child) => renderColumnChild(child, primary)).join("")}</mj-column>`).join("");
  return `<mj-section padding="12px 16px">${columns}</mj-section>`;
}

function renderFooter(block: FooterBlock): string {
  const website = block.websiteUrl ? `<a href="${attr(block.websiteUrl)}" style="color:inherit">Website</a> · ` : "";
  const privacy = block.privacyUrl ? `<a href="${attr(block.privacyUrl)}" style="color:inherit">Privacy</a> · ` : "";
  const unsubscribe = `<a href="{% unsubscribe_link %}" style="color:inherit">${escapeXml(block.unsubscribeLabel ?? "Unsubscribe")}</a>`;
  return `<mj-section padding="18px 0 26px"><mj-column><mj-text align="center" font-size="11px" line-height="1.6" color="#6b7280">${escapeXml(block.companyName)}<br/>${escapeXml(block.physicalAddress)}<br/>${website}${privacy}${unsubscribe}</mj-text></mj-column></mj-section>`;
}

function renderBlock(block: CampaignBlock, campaign: CampaignDocumentV1): string {
  switch (block.type) {
    case "preheader": return "";
    case "header": {
      const logo = block.logo ? `<mj-image align="left" padding="14px 24px" width="${block.logo.width ?? 120}px" src="${attr(block.logo.src)}" alt="${attr(block.logo.alt)}" />` : `<mj-text padding="18px 24px" font-weight="800" font-size="18px">${escapeXml(block.wordmark ?? campaign.brand.name)}</mj-text>`;
      return `<mj-section padding="0"><mj-column>${block.homeUrl ? `<mj-raw><a href="${attr(block.homeUrl)}" style="text-decoration:none;color:inherit"></mj-raw>${logo}<mj-raw></a></mj-raw>` : logo}</mj-column></mj-section>`;
    }
    case "hero": return renderHero(block, campaign.brand.colors.primary);
    case "text": return renderText(block);
    case "image": return renderImage(block);
    case "button": return renderButton(block).replace("{{PRIMARY_COLOR}}", campaign.brand.colors.primary);
    case "divider": return `<mj-section padding="4px 24px"><mj-column><mj-divider border-width="1px" border-color="#e5e7eb" /></mj-column></mj-section>`;
    case "spacer": return `<mj-spacer height="${block.size}px" />`;
    case "social": return renderSocial(block);
    case "product-grid": return renderProductGrid(block, campaign.brand.colors.primary);
    case "columns": return renderColumns(block, campaign.brand.colors.primary);
    case "footer": return renderFooter(block);
  }
}

export function campaignToMjml(campaign: CampaignDocumentV1): string {
  const body = campaign.blocks.map((block) => renderBlock(block, campaign)).join("");
  return `<mjml><mj-head><mj-title>${escapeXml(campaign.subject)}</mj-title><mj-preview>${escapeXml(campaign.preheader)}</mj-preview><mj-attributes><mj-all font-family="${attr(campaign.brand.fontFamily)}" color="${campaign.brand.colors.text}" /><mj-text font-size="15px" /><mj-body width="600px" /></mj-attributes></mj-head><mj-body width="600px" background-color="${campaign.brand.colors.background}">${body}</mj-body></mjml>`;
}
