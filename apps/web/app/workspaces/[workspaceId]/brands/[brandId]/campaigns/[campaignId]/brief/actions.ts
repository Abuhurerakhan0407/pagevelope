"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CampaignDocumentV1, HexColor } from "@pagevelope/editor-schema";
import { validateCampaignDocument } from "@pagevelope/editor-schema";
import { stableStringify } from "@pagevelope/email-renderer";
import { getSupabasePublicConfig } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const systems = new Set([
  "product-launch",
  "collection-editorial",
  "restock-waitlist",
  "limited-offer",
  "lifecycle-reminder",
]);
const motionLevels = new Set(["none", "subtle", "expressive"]);
const directionKeys = new Set(["editorial", "product", "motion"]);

type DirectionKey = "editorial" | "product" | "motion";

type CampaignSeed = {
  id: string;
  name: string;
  current_version_number: number;
  product_selection_completed_at: string | null;
  brief_goal: string | null;
  brief_audience: string | null;
  brief_offer: string | null;
  brief_tone: string | null;
  brief_motion_level: string | null;
};

type BrandSeed = {
  name: string;
  primary_color: string;
  accent_color: string;
  background_color: string;
  text_color: string;
  font_family: string;
  website_url: string | null;
  company_name: string | null;
  legal_address: string | null;
};

type ProductSeed = {
  id: string;
  title: string;
  price_amount: string | number;
  currency: string;
  image_url: string | null;
  product_url: string | null;
};

function briefPath(workspaceId: string, brandId: string, campaignId: string) {
  return `/workspaces/${workspaceId}/brands/${brandId}/campaigns/${campaignId}/brief`;
}

function productsPath(workspaceId: string, brandId: string, campaignId: string) {
  return `/workspaces/${workspaceId}/brands/${brandId}/campaigns/${campaignId}/products`;
}

function asHex(value: string): HexColor {
  return value as HexColor;
}

function productPrice(product: ProductSeed) {
  const amount = Number(product.price_amount);
  if (product.currency === "INR") return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  return `${product.currency} ${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function directionDocument(
  campaign: CampaignSeed,
  brand: BrandSeed,
  direction: DirectionKey,
  products: ProductSeed[],
): CampaignDocumentV1 {
  const homeUrl = brand.website_url || "https://example.com";
  const baseUrl = homeUrl.replace(/\/$/, "");
  const offer = campaign.brief_offer || "Discover the offer";
  const goal = campaign.brief_goal || campaign.name;
  const audience = campaign.brief_audience || "customers";
  const tone = campaign.brief_tone || "clear and confident";
  const leadProduct = products[0];
  const leadHref = leadProduct?.product_url || `${baseUrl}/products`;
  const leadImage = leadProduct?.image_url || "";

  const hero = direction === "editorial"
    ? {
        eyebrow: "A NEW STORY",
        heading: campaign.name,
        body: `${goal} Built for ${audience}, with a ${tone.toLowerCase()} point of view.`,
        cta: "Discover the story",
      }
    : direction === "product"
      ? {
          eyebrow: "FEATURED",
          heading: offer,
          body: `${goal} Lead with product value, proof, and one decisive next step.`,
          cta: "Shop the feature",
        }
      : {
          eyebrow: "NEW NOW",
          heading: campaign.name,
          body: `${goal} Use motion as the attention hook while the first frame keeps the message complete.`,
          cta: "See what changed",
        };

  const blocks: CampaignDocumentV1["blocks"] = [
    {
      id: "header-1",
      type: "header",
      wordmark: brand.name.toUpperCase(),
      homeUrl,
    },
    {
      id: "hero-1",
      type: "hero",
      eyebrow: hero.eyebrow,
      heading: hero.heading,
      body: hero.body,
      image: leadImage
        ? {
            src: leadImage,
            alt: direction === "motion"
              ? `Static first frame featuring ${leadProduct?.title || campaign.name}`
              : `${leadProduct?.title || campaign.name} campaign hero`,
            width: 520,
          }
        : undefined,
      cta: { label: hero.cta, href: leadHref },
      align: direction === "editorial" ? "left" : "center",
      backgroundColor: direction === "product" ? asHex(brand.background_color) : asHex(brand.accent_color),
    },
    {
      id: "text-1",
      type: "text",
      heading: direction === "product" ? "Why it earns the click" : "The campaign idea",
      body: direction === "editorial"
        ? `Tell the story first, then resolve it with ${offer}.`
        : direction === "product"
          ? `${offer}. Keep the proof concise and make the selected products the visual anchor.`
          : `The motion treatment is ${campaign.brief_motion_level || "subtle"}; the static first frame must still communicate the core offer.`,
      align: "left",
    },
    {
      id: "products-1",
      type: "product-grid",
      heading: direction === "editorial" ? "Shop the story" : direction === "motion" ? "Featured in this drop" : "Featured products",
      columns: 2,
      products: products.map((product) => ({
        id: product.id,
        title: product.title,
        price: productPrice(product),
        image: {
          src: product.image_url ?? "",
          alt: product.title,
        },
        href: product.product_url || `${baseUrl}/products`,
      })),
    },
    {
      id: "footer-1",
      type: "footer",
      companyName: brand.company_name || brand.name,
      physicalAddress: brand.legal_address || "Physical business address",
      websiteUrl: homeUrl,
      privacyUrl: `${baseUrl}/privacy`,
    },
  ];

  return {
    schemaVersion: "1.0.0",
    id: campaign.id,
    name: campaign.name,
    locale: "en-IN",
    subject: direction === "product" ? offer : campaign.name,
    preheader: direction === "motion" ? `A motion-led campaign from ${brand.name}.` : `${campaign.name} from ${brand.name}.`,
    brand: {
      name: brand.name,
      fontFamily: brand.font_family,
      colors: {
        background: asHex(brand.background_color),
        surface: "#FFFFFF",
        text: asHex(brand.text_color),
        muted: "#6B7280",
        primary: asHex(brand.primary_color),
      },
    },
    blocks,
  };
}

export async function saveCampaignBrief(
  workspaceId: string,
  brandId: string,
  campaignId: string,
  formData: FormData,
) {
  if (!getSupabasePublicConfig()) redirect("/dashboard");

  const campaignSystem = String(formData.get("campaignSystem") ?? "").trim();
  const goal = String(formData.get("goal") ?? "").trim();
  const audience = String(formData.get("audience") ?? "").trim();
  const offer = String(formData.get("offer") ?? "").trim();
  const tone = String(formData.get("tone") ?? "").trim();
  const motionLevel = String(formData.get("motionLevel") ?? "").trim();
  const path = briefPath(workspaceId, brandId, campaignId);

  if (
    !systems.has(campaignSystem) ||
    goal.length < 3 || goal.length > 600 ||
    audience.length < 2 || audience.length > 300 ||
    offer.length < 1 || offer.length > 300 ||
    tone.length < 2 || tone.length > 120 ||
    !motionLevels.has(motionLevel)
  ) {
    redirect(`${path}?error=invalid-brief&edit=1`);
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) redirect("/auth/sign-in");

  const { error } = await supabase.rpc("save_campaign_brief", {
    target_workspace_id: workspaceId,
    target_campaign_id: campaignId,
    requested_system: campaignSystem,
    requested_goal: goal,
    requested_audience: audience,
    requested_offer: offer,
    requested_tone: tone,
    requested_motion_level: motionLevel,
  });

  if (error) redirect(`${path}?error=brief-save-failed&edit=1`);

  revalidatePath(path);
  revalidatePath(`/workspaces/${workspaceId}/brands/${brandId}`);
  redirect(`${path}?brief=1`);
}

export async function selectCreativeDirection(
  workspaceId: string,
  brandId: string,
  campaignId: string,
  formData: FormData,
) {
  if (!getSupabasePublicConfig()) redirect("/dashboard");

  const rawDirectionKey = String(formData.get("directionKey") ?? "").trim();
  const path = briefPath(workspaceId, brandId, campaignId);
  if (!directionKeys.has(rawDirectionKey)) redirect(`${path}?error=invalid-direction`);
  const directionKey = rawDirectionKey as DirectionKey;

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) redirect("/auth/sign-in");

  const [{ data: campaignData, error: campaignError }, { data: brandData, error: brandError }, { data: links, error: linksError }] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id,name,current_version_number,product_selection_completed_at,brief_goal,brief_audience,brief_offer,brief_tone,brief_motion_level")
      .eq("workspace_id", workspaceId)
      .eq("brand_id", brandId)
      .eq("id", campaignId)
      .maybeSingle(),
    supabase
      .from("brands")
      .select("name,primary_color,accent_color,background_color,text_color,font_family,website_url,company_name,legal_address")
      .eq("workspace_id", workspaceId)
      .eq("id", brandId)
      .maybeSingle(),
    supabase
      .from("campaign_products")
      .select("product_id,position")
      .eq("workspace_id", workspaceId)
      .eq("campaign_id", campaignId)
      .order("position", { ascending: true }),
  ]);

  if (campaignError || brandError || linksError || !campaignData || !brandData) {
    redirect(`${path}?error=direction-save-failed`);
  }

  const campaign = campaignData as CampaignSeed;
  if (!campaign.product_selection_completed_at || !links?.length) {
    redirect(productsPath(workspaceId, brandId, campaignId));
  }

  const productIds = links.map((link) => String(link.product_id));
  const { data: productData, error: productError } = await supabase
    .from("products")
    .select("id,title,price_amount,currency,image_url,product_url")
    .eq("workspace_id", workspaceId)
    .eq("brand_id", brandId)
    .in("id", productIds);

  if (productError || !productData || productData.length !== productIds.length) {
    redirect(`${path}?error=direction-seed-failed`);
  }

  const byId = new Map((productData as ProductSeed[]).map((product) => [product.id, product]));
  const products = productIds.map((id) => byId.get(id)).filter((product): product is ProductSeed => Boolean(product));
  if (products.length !== productIds.length) redirect(`${path}?error=direction-seed-failed`);

  if (products.some((product) => !product.image_url?.trim())) {
    redirect(`${path}?error=product-images-required`);
  }

  const brand = brandData as BrandSeed;
  const source = directionDocument(campaign, brand, directionKey, products);
  const validation = validateCampaignDocument(source);
  if (!validation.success || !validation.data) {
    redirect(`${path}?error=direction-seed-failed`);
  }

  const canonicalSource = stableStringify(validation.data);
  const sourceSha256 = createHash("sha256").update(canonicalSource, "utf8").digest("hex");
  const { error: seedError } = await supabase.rpc("select_campaign_direction_and_seed", {
    target_workspace_id: workspaceId,
    target_campaign_id: campaignId,
    direction_key: directionKey,
    expected_current_version: campaign.current_version_number,
    source_json: validation.data,
    source_sha256: sourceSha256,
  });

  if (seedError) redirect(`${path}?error=direction-seed-failed`);

  revalidatePath(path);
  revalidatePath(`/workspaces/${workspaceId}/brands/${brandId}`);
  redirect(
    `/builder?workspaceId=${encodeURIComponent(workspaceId)}&brandId=${encodeURIComponent(brandId)}&campaignId=${encodeURIComponent(campaignId)}`,
  );
}
