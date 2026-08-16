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

const PRODUCT_URL = "https://example.com/products/orbit";
const HOME_URL = "https://example.com";

function toCampaignBlock(block: BuilderBlock): CampaignBlock {
  switch (block.kind) {
    case "header":
      return {
        id: block.id,
        type: "header",
        wordmark: block.title,
        homeUrl: HOME_URL,
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
          alt: "Orbit insulated bottle",
          width: 520,
        },
        cta: block.cta
          ? {
              label: block.cta,
              href: PRODUCT_URL,
            }
          : undefined,
        align: "left",
        backgroundColor: "#EDE9FE",
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
          href: PRODUCT_URL,
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
            id: `${block.id}-lilac`,
            title: "Orbit / Lilac",
            price: "₹2,499",
            image: {
              src: "https://images.example.com/orbit-lilac.jpg",
              alt: "Lilac Orbit bottle",
            },
            href: "https://example.com/products/orbit-lilac",
          },
          {
            id: `${block.id}-ink`,
            title: "Orbit / Ink",
            price: "₹2,499",
            image: {
              src: "https://images.example.com/orbit-ink.jpg",
              alt: "Ink Orbit bottle",
            },
            href: "https://example.com/products/orbit-ink",
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
            href: "https://example.com/instagram",
            label: block.body?.trim() || "Instagram",
          },
        ],
      };
    case "footer":
      return {
        id: block.id,
        type: "footer",
        companyName: block.title,
        physicalAddress: block.body ?? "Physical business address",
        websiteUrl: HOME_URL,
        privacyUrl: "https://example.com/privacy",
      };
  }
}

export function buildCampaignDocument(blocks: BuilderBlock[]): CampaignDocumentV1 {
  return {
    schemaVersion: "1.0.0",
    id: "campaign_orbit_visual_builder",
    name: "Orbit Bottle Launch",
    locale: "en-IN",
    subject: "Meet Orbit — hydration without the bulk",
    preheader: "A lighter bottle, built for everyday carry.",
    brand: {
      name: "Northstar Goods",
      fontFamily: "Arial, Helvetica, sans-serif",
      colors: {
        background: "#F5F3EE",
        surface: "#FFFFFF",
        text: "#171717",
        muted: "#6B7280",
        primary: "#6F5CFB",
      },
    },
    blocks: blocks.map(toCampaignBlock),
  };
}
