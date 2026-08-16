export type HexColor = `#${string}`;
export type Align = "left" | "center" | "right";

export interface CampaignBrand {
  name: string;
  fontFamily: string;
  colors: {
    background: HexColor;
    surface: HexColor;
    text: HexColor;
    muted: HexColor;
    primary: HexColor;
  };
}

export interface LinkValue {
  label: string;
  href: string;
}

export interface ImageValue {
  src: string;
  alt: string;
  width?: number;
  decorative?: boolean;
}

export interface BaseBlock { id: string; }
export interface PreheaderBlock extends BaseBlock { type: "preheader"; text: string; }
export interface HeaderBlock extends BaseBlock {
  type: "header";
  logo?: ImageValue;
  wordmark?: string;
  homeUrl?: string;
}
export interface HeroBlock extends BaseBlock {
  type: "hero";
  eyebrow?: string;
  heading: string;
  body?: string;
  image?: ImageValue;
  cta?: LinkValue;
  align?: Align;
  backgroundColor?: HexColor;
}
export interface TextBlock extends BaseBlock {
  type: "text";
  heading?: string;
  body: string;
  align?: Align;
}
export interface ImageBlock extends BaseBlock {
  type: "image";
  image: ImageValue;
  href?: string;
}
export interface ButtonBlock extends BaseBlock {
  type: "button";
  cta: LinkValue;
  align?: Align;
}
export interface DividerBlock extends BaseBlock { type: "divider"; }
export interface SpacerBlock extends BaseBlock { type: "spacer"; size: 8 | 12 | 16 | 24 | 32 | 40 | 48 | 64; }
export interface SocialBlock extends BaseBlock {
  type: "social";
  links: Array<{ network: "instagram" | "facebook" | "x" | "tiktok" | "linkedin"; href: string; label: string }>;
}
export interface ProductItem {
  id: string;
  title: string;
  price?: string;
  image: ImageValue;
  href: string;
}
export interface ProductGridBlock extends BaseBlock {
  type: "product-grid";
  heading?: string;
  products: ProductItem[];
  columns?: 1 | 2 | 3;
}
export type ColumnChild = TextBlock | ImageBlock | ButtonBlock;
export interface ColumnsBlock extends BaseBlock {
  type: "columns";
  columns: Array<{ id: string; width?: 25 | 33 | 50 | 66 | 75; blocks: ColumnChild[] }>;
}
export interface FooterBlock extends BaseBlock {
  type: "footer";
  companyName: string;
  physicalAddress: string;
  websiteUrl?: string;
  privacyUrl?: string;
  unsubscribeLabel?: string;
}

export type CampaignBlock =
  | PreheaderBlock
  | HeaderBlock
  | HeroBlock
  | TextBlock
  | ImageBlock
  | ButtonBlock
  | DividerBlock
  | SpacerBlock
  | SocialBlock
  | ProductGridBlock
  | ColumnsBlock
  | FooterBlock;

export interface CampaignDocumentV1 {
  schemaVersion: "1.0.0";
  id: string;
  name: string;
  locale: string;
  subject: string;
  preheader: string;
  brand: CampaignBrand;
  blocks: CampaignBlock[];
}
