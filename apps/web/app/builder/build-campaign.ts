import type { CampaignBlock, CampaignDocumentV1 } from "@pagevelope/editor-schema";

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

function toCampaignBlock(block: BuilderBlock, context: CampaignBuildContext): CampaignBlock {
  switch (block.kind) {
    case "header":
      return {
        id: block.id,
        type: "header",
        wordmark: block.title || context.brand.name,
        homeUrl: homeUrl(context),
      };
    case "hero":
      return {
        id: block.id,
        type: "hero",
        eyebrow: "New product",
        heading: block.title,
        body: block.body,
        image: {
          src: "https://images.example.com/orbit.jpg",
          alt: "Featured product campaign image",
          width: 520,
        },
        cta: block.cta
          ? {
              label: block.cta,
              href: productUrl(context),
            }
          : undefined,
        align: "left",
        backgroundColor: context.brand.accentColor,
      };
    case "text":
      return {
        id: block.id,
        type: "text",
        heading: block.title,
        body: block.body ?? "Add campaign copy here.",
        align: "left",
      };
    case "image":
      return {
        id: block.id,
        type: "image",
        image: {
          src: "https://images.example.com/campaign-placeholder.jpg",
          alt: (block.body ?? block.title).replace(/^Alt text:\s*/i, ""),
          width: 520,
        },
      };
    case "button":
      return {
        id: block.id,
        type: "button",
        cta: {
          label: block.cta ?? block.title,
          href: productUrl(context),
        },
        align: "left",
      };
    case "products":
      return {
        id: block.id,
        type: "product-grid",
        heading: block.title,
        columns: 2,
        products: [
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
    case "divider":
      return {
        id: block.id,
        type: "divider",
      };
    case "spacer":
      return {
        id: block.id,
        type: "spacer",
        size: 24,
      };
    case "social":
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
    case "footer":
      return {
        id: block.id,
        type: "footer",
        companyName: block.title || context.brand.companyName || context.brand.name,
        physicalAddress: block.body || context.brand.legalAddress || "Physical business address",
        websiteUrl: homeUrl(context),
        privacyUrl: `${homeUrl(context).replace(/\/$/, "")}/privacy`,
      };
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
        background: context.brand.backgroundColor,
        surface: "#FFFFFF",
        text: context.brand.textColor,
        muted: "#6B7280",
        primary: context.brand.primaryColor,
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
        blocks.push({ id: block.id, kind: "header", label: "Header", title: block.wordmark || document.brand.name });
        break;
      case "hero":
        blocks.push({
          id: block.id,
          kind: "hero",
          label: "Hero",
          title: block.heading,
          body: block.body,
          cta: block.cta?.label,
        });
        break;
      case "text":
        blocks.push({ id: block.id, kind: "text", label: "Text", title: block.heading || "Text", body: block.body });
        break;
      case "image":
        blocks.push({ id: block.id, kind: "image", label: "Image", title: "Campaign image", body: `Alt text: ${block.image.alt}` });
        break;
      case "button":
        blocks.push({ id: block.id, kind: "button", label: "Button", title: block.cta.label, cta: block.cta.label });
        break;
      case "product-grid":
        blocks.push({
          id: block.id,
          kind: "products",
          label: "Product grid",
          title: block.heading || "Featured products",
          body: block.products.map((product) => `${product.title}${product.price ? ` · ${product.price}` : ""}`).join("\n"),
        });
        break;
      case "divider":
        blocks.push({ id: block.id, kind: "divider", label: "Divider", title: "Divider" });
        break;
      case "spacer":
        blocks.push({ id: block.id, kind: "spacer", label: "Spacer", title: `${block.size}px spacer` });
        break;
      case "social":
        blocks.push({ id: block.id, kind: "social", label: "Social", title: "Follow us", body: block.links[0]?.label || "Social" });
        break;
      case "footer":
        blocks.push({ id: block.id, kind: "footer", label: "Footer", title: block.companyName, body: block.physicalAddress });
        break;
      case "columns":
        break;
    }
  }

  return blocks;
}
