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

function briefPath(workspaceId: string, brandId: string, campaignId: string) {
  return `/workspaces/${workspaceId}/brands/${brandId}/campaigns/${campaignId}/brief`;
}

function asHex(value: string): HexColor {
  return value as HexColor;
}

function directionDocument(campaign: CampaignSeed, brand: BrandSeed, direction: DirectionKey): CampaignDocumentV1 {
  const homeUrl = brand.website_url || "https://example.com";
  const baseUrl = homeUrl.replace(/\/$/, "");
  const offer = campaign.brief_offer || "Discover the offer";
  const goal = campaign.brief_goal || campaign.name;
  const audience = campaign.brief_audience || "customers";
  const tone = campaign.brief_tone || "clear and confident";

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
      image: {
        src: direction === "motion"
          ? "https://images.example.com/motion-first-frame.jpg"
          : "https://images.example.com/campaign-hero.jpg",
        alt: direction === "motion"
          ? "Meaningful first frame for the campaign motion concept"
          : `${campaign.name} campaign hero`,
        width: 520,
      },
      cta: { label: hero.cta, href: `${baseUrl}/products/featured` },
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
          ? `${offer}. Keep the proof concise and make the product the visual anchor.`
          : `The motion treatment is ${campaign.brief_motion_level || "subtle"}; the static first frame must still communicate the core offer.`,
      align: "left",
    },
    ...(direction === "product"
      ? [{
          id: "products-1",
          type: "product-grid" as const,
          heading: "Featured products",
          columns: 2 as const,
          products: [
            {
              id: "featured-one",
              title: "Featured product one",
              price: "Add price",
              image: { src: "https://images.example.com/product-one.jpg", alt: "Featured product one" },
              href: `${baseUrl}/products/featured-one`,
            },
            {
              id: "featured-two",
              title: "Featured product two",
              price: "Add price",
              image: { src: "https://images.example.com/product-two.jpg", alt: "Featured product two" },
              href: `${baseUrl}/products/featured-two`,
            },
          ],
        }]
      : []),
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

  const [{ data: campaignData, error: campaignError }, { data: brandData, error: brandError }] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id,name,current_version_number,brief_goal,brief_audience,brief_offer,brief_tone,brief_motion_level")
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
  ]);

  if (campaignError || brandError || !campaignData || !brandData) {
    redirect(`${path}?error=direction-save-failed`);
  }

  const campaign = campaignData as CampaignSeed;
  const brand = brandData as BrandSeed;
  const source = directionDocument(campaign, brand, directionKey);
  const validation = validateCampaignDocument(source);
  if (!validation.success || !validation.data) {
    redirect(`${path}?error=direction-save-failed`);
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

  if (seedError) redirect(`${path}?error=direction-save-failed`);

  revalidatePath(path);
  revalidatePath(`/workspaces/${workspaceId}/brands/${brandId}`);
  redirect(
    `/builder?workspaceId=${encodeURIComponent(workspaceId)}&brandId=${encodeURIComponent(brandId)}&campaignId=${encodeURIComponent(campaignId)}`,
  );
}
