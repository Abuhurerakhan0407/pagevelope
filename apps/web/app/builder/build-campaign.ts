import type { CampaignBlock, CampaignDocumentV1, HexColor } from "@pagevelope/editor-schema";

export type BuilderBlockKind =
  | "header"
  | "hero"
  | "text"
  | "image"
  | "button"
  | "products"
  | "divider"
  | "spacer"
  | "social"
  | "footer";

export interface BuilderBlock {
  id: string;
  kind: BuilderBlockKind;
  label: string;
  title: string;
  body?: string;
  cta?: string;
  /**
   * The last schema-valid source block. The visual builder exposes a constrained
   * subset of fields, so untouched production data (product URLs/images, hero
   * media, CTA hrefs, footer links, etc.) must survive hydration → edit → save.
   */
  source?: CampaignBlock;
}

export interface CampaignBuildContext {
  campaignId: string;
  campaignName: string;
  locale: string;
  subject: string;
  preheader: string;
  brand: {
    name: string;
    fontFamily: string;
    primaryColor: string;
    accentColor: string;
    backgroundColor: string;
    textColor: string;
    websiteUrl?: string | null;
    companyName?: string | null;
    legalAddress?: string | null;
  };
}

export const demoCampaignContext: CampaignBuildContext = {
  campaignId: "campaign_orbit_visual_builder",
  campaignName: "Orbit Bottle Launch",
  locale: "en-IN",
  subject: "Meet Orbit — hydration without the bulk",
  preheader: "A lighter bottle, built for everyday carry.",
  brand: {
    name: "Northstar Goods",
    fontFamily: "Arial, Helvetica, sans-serif",
    primaryColor: "#6F5CFB",
    accentColor: "#A78BFA",
    backgroundColor: "#F5F3EE",
    textColor: "#171717",
    websiteUrl: "https://example.com",
    companyName: "Northstar Goods",
    legalAddress: "12 Market Road, Mumbai, Maharashtra 400001, India",
  },
};

function homeUrl(context: CampaignBuildContext) {
  return context.brand.websiteUrl || "https://example.com";
}

function productUrl(context: CampaignBuildContext) {
  return `${homeUrl(context).replace(/\/$/, "")}/products/featured`;
}

function hex(value: string): HexColor {
  return value as HexColor;
}

function sourceOfType<T extends CampaignBlock["type"]>(
  block: BuilderBlock,
  type: T,
): Extract<CampaignBlock, { type: T }> | undefined {
  return block.source?.type === type
    ? block.source as Extract<CampaignBlock, { type: T }>
    : undefined;
}

function toCampaignBlock(block: BuilderBlock, context: CampaignBuildContext): CampaignBlock {
  switch (block.kind) {
    case "header": {
      const source = sourceOfType(block, "header");
      return {
        ...(source ?? {}),
        id: block.id,
        type: "header",
        wordmark: block.title || context.brand.name,
        homeUrl: source?.homeUrl ?? homeUrl(context),
      };
    }
    case "hero": {
      const source = sourceOfType(block, "hero");
      const cta = block.cta
        ? {
            label: block.cta,
            href: source?.cta?.href ?? productUrl(context),
          }
        : undefined;
      return {
        ...(source ?? {}),
        id: block.id,
        type: "hero",
        eyebrow: source?.eyebrow ?? "New product",
        heading: block.title,
        body: block.body,
        image: source?.image ?? {
          src: "https://images.example.com/orbit.jpg",
          alt: "Featured product campaign image",
          width: 520,
        },
        cta,
        align: source?.align ?? "left",
        backgroundColor: source?.backgroundColor ?? hex(context.brand.accentColor),
      };
    }
    case "text": {
      const source = sourceOfType(block, "text");
      return {
        ...(source ?? {}),
        id: block.id,
        type: "text",
        heading: block.title,
        body: block.body ?? "Add campaign copy here.",
        align: source?.align ?? "left",
      };
    }
    case "image": {
      const source = sourceOfType(block, "image");
      const alt = (block.body ?? block.title).replace(/^Alt text:\s*/i, "");
      return {
        ...(source ?? {}),
        id: block.id,
        type: "image",
        image: source?.image
          ? { ...source.image, alt }
          : {
              src: "https://images.example.com/campaign-placeholder.jpg",
              alt,
              width: 520,
            },
      };
    }
    case "button": {
      const source = sourceOfType(block, "button");
      return {
        ...(source ?? {}),
        id: block.id,
        type: "button",
        cta: {
          label: block.cta ?? block.title,
          href: source?.cta.href ?? productUrl(context),
        },
        align: source?.align ?? "left",
      };
    }
    case "products": {
      const source = sourceOfType(block, "product-grid");
      return {
        ...(source ?? {}),
        id: block.id,
        type: "product-grid",
        heading: block.title,
        columns: source?.columns ?? 2,
        products: source?.products ?? [
          {
            id: `${block.id}-one`,
            title: "Featured product one",
            price: "₹2,499",
            image: {
              src: "https://images.example.com/product-one.jpg",
              alt: "Featured product one",
            },
            href: productUrl(context),
          },
          {
            id: `${block.id}-two`,
            title: "Featured product two",
            price: "₹2,499",
            image: {
              src: "https://images.example.com/product-two.jpg",
              alt: "Featured product two",
            },
            href: productUrl(context),
          },
        ],
      };
    }
    case "divider": {
      const source = sourceOfType(block, "divider");
      return { ...(source ?? {}), id: block.id, type: "divider" };
    }
    case "spacer": {
      const source = sourceOfType(block, "spacer");
      return {
        ...(source ?? {}),
        id: block.id,
        type: "spacer",
        size: source?.size ?? 24,
      };
    }
    case "social": {
      const source = sourceOfType(block, "social");
      if (source) {
        const links = source.links.map((link, index) => index === 0
          ? { ...link, label: block.body?.trim() || link.label }
          : link);
        return { ...source, id: block.id, type: "social", links };
      }
      return {
        id: block.id,
        type: "social",
        links: [
          {
            network: "instagram",
            href: `${homeUrl(context).replace(/\/$/, "")}/instagram`,
            label: block.body?.trim() || "Instagram",
          },
        ],
      };
    }
    case "footer": {
      const source = sourceOfType(block, "footer");
      return {
        ...(source ?? {}),
        id: block.id,
        type: "footer",
        companyName: block.title || context.brand.companyName || context.brand.name,
        physicalAddress: block.body || context.brand.legalAddress || "Physical business address",
        websiteUrl: source?.websiteUrl ?? homeUrl(context),
        privacyUrl: source?.privacyUrl ?? `${homeUrl(context).replace(/\/$/, "")}/privacy`,
      };
    }
  }
}

export function buildCampaignDocument(
  blocks: BuilderBlock[],
  context: CampaignBuildContext = demoCampaignContext,
): CampaignDocumentV1 {
  return {
    schemaVersion: "1.0.0",
    id: context.campaignId,
    name: context.campaignName,
    locale: context.locale,
    subject: context.subject,
    preheader: context.preheader,
    brand: {
      name: context.brand.name,
      fontFamily: context.brand.fontFamily,
      colors: {
        background: hex(context.brand.backgroundColor),
        surface: "#FFFFFF",
        text: hex(context.brand.textColor),
        muted: "#6B7280",
        primary: hex(context.brand.primaryColor),
      },
    },
    blocks: blocks.map((block) => toCampaignBlock(block, context)),
  };
}

export function builderBlocksFromCampaignDocument(document: CampaignDocumentV1): BuilderBlock[] {
  const blocks: BuilderBlock[] = [];

  for (const block of document.blocks) {
    switch (block.type) {
      case "preheader":
        break;
      case "header":
        blocks.push({ id: block.id, kind: "header", label: "Header", title: block.wordmark || document.brand.name, source: block });
        break;
      case "hero":
        blocks.push({
          id: block.id,
          kind: "hero",
          label: "Hero",
          title: block.heading,
          body: block.body,
          cta: block.cta?.label,
          source: block,
        });
        break;
      case "text":
        blocks.push({ id: block.id, kind: "text", label: "Text", title: block.heading || "Text", body: block.body, source: block });
        break;
      case "image":
        blocks.push({ id: block.id, kind: "image", label: "Image", title: "Campaign image", body: `Alt text: ${block.image.alt}`, source: block });
        break;
      case "button":
        blocks.push({ id: block.id, kind: "button", label: "Button", title: block.cta.label, cta: block.cta.label, source: block });
        break;
      case "product-grid":
        blocks.push({
          id: block.id,
          kind: "products",
          label: "Product grid",
          title: block.heading || "Featured products",
          body: block.products.map((product) => `${product.title}${product.price ? ` · ${product.price}` : ""}`).join("\n"),
          source: block,
        });
        break;
      case "divider":
        blocks.push({ id: block.id, kind: "divider", label: "Divider", title: "Divider", source: block });
        break;
      case "spacer":
        blocks.push({ id: block.id, kind: "spacer", label: "Spacer", title: `${block.size}px spacer`, source: block });
        break;
      case "social":
        blocks.push({ id: block.id, kind: "social", label: "Social", title: "Follow us", body: block.links[0]?.label || "Social", source: block });
        break;
      case "footer":
        blocks.push({ id: block.id, kind: "footer", label: "Footer", title: block.companyName, body: block.physicalAddress, source: block });
        break;
      case "columns":
        break;
    }
  }

  return blocks;
}
