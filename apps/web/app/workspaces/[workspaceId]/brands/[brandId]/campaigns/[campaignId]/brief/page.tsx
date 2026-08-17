import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabasePublicConfig } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { saveCampaignBrief, selectCreativeDirection } from "./actions";
import styles from "./brief.module.css";

type PageProps = {
  params: Promise<{ workspaceId: string; brandId: string; campaignId: string }>;
  searchParams: Promise<{ error?: string; brief?: string; edit?: string }>;
};

type Direction = {
  key: "editorial" | "product" | "motion";
  title: string;
  description: string;
  layout: string;
  motion: string;
};

type Campaign = {
  id: string;
  name: string;
  status: string;
  product_selection_completed_at: string | null;
  campaign_system: string | null;
  brief_goal: string | null;
  brief_audience: string | null;
  brief_offer: string | null;
  brief_tone: string | null;
  brief_motion_level: string | null;
  creative_directions: unknown;
  selected_direction_key: string | null;
  brief_completed_at: string | null;
};

const errorMessages: Record<string, string> = {
  "invalid-brief": "Complete every brief field using the allowed values.",
  "brief-save-failed": "The campaign brief could not be saved. Nothing was partially written.",
  "invalid-direction": "Choose one of the three generated creative directions.",
  "direction-save-failed": "The creative direction could not be selected.",
  "direction-seed-failed": "The selected direction could not be converted into a valid first campaign version.",
  "product-images-required": "Every selected product needs an image before the campaign can be generated. Add product images and try again.",
};

const systemLabels: Record<string, string> = {
  "product-launch": "Product launch",
  "collection-editorial": "Collection editorial",
  "restock-waitlist": "Restock / waitlist",
  "limited-offer": "Limited offer",
  "lifecycle-reminder": "Lifecycle reminder",
};

const directionMeta: Record<string, { number: string; accent: string }> = {
  editorial: { number: "01", accent: "Story-led" },
  product: { number: "02", accent: "Conversion-led" },
  motion: { number: "03", accent: "Attention-led" },
};

function parseDirections(value: unknown): Direction[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Direction => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as Record<string, unknown>;
    return (
      ["editorial", "product", "motion"].includes(String(candidate.key)) &&
      typeof candidate.title === "string" &&
      typeof candidate.description === "string" &&
      typeof candidate.layout === "string" &&
      typeof candidate.motion === "string"
    );
  });
}

export const dynamic = "force-dynamic";

export default async function CampaignBriefPage({ params, searchParams }: PageProps) {
  const { workspaceId, brandId, campaignId } = await params;
  const query = await searchParams;

  if (!getSupabasePublicConfig()) redirect("/dashboard");

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) redirect("/auth/sign-in");

  const [{ data: workspace }, { data: brand }, { data: campaignData }] = await Promise.all([
    supabase.from("workspaces").select("id,name,slug").eq("id", workspaceId).maybeSingle(),
    supabase
      .from("brands")
      .select("id,name,primary_color,accent_color")
      .eq("workspace_id", workspaceId)
      .eq("id", brandId)
      .maybeSingle(),
    supabase
      .from("campaigns")
      .select(
        "id,name,status,product_selection_completed_at,campaign_system,brief_goal,brief_audience,brief_offer,brief_tone,brief_motion_level,creative_directions,selected_direction_key,brief_completed_at",
      )
      .eq("workspace_id", workspaceId)
      .eq("brand_id", brandId)
      .eq("id", campaignId)
      .maybeSingle(),
  ]);

  if (!workspace || !brand || !campaignData) redirect("/dashboard");

  const campaign = campaignData as Campaign;
  if (!campaign.product_selection_completed_at) {
    redirect(productsPath(workspaceId, brandId, campaignId));
  }

  const directions = parseDirections(campaign.creative_directions);
  const briefReady = Boolean(campaign.brief_completed_at && directions.length === 3);
  const showForm = !briefReady || query.edit === "1";
  const errorMessage = query.error ? errorMessages[query.error] : null;
  const saveBrief = saveCampaignBrief.bind(null, workspaceId, brandId, campaignId);
  const chooseDirection = selectCreativeDirection.bind(null, workspaceId, brandId, campaignId);

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <Link className={styles.logo} href="/dashboard"><span>P</span>Pagevelope</Link>
        <div className={styles.crumbs}>
          <Link href={`/workspaces/${workspaceId}/brands/${brandId}`}>{brand.name}</Link>
          <span>/</span>
          <strong>{campaign.name}</strong>
        </div>
      </header>

      <section className={styles.page}>
        <div className={styles.progress}>
          <div className={styles.progressItem}><i className={styles.done}>✓</i><span>Brand</span></div>
          <div className={styles.progressLine} />
          <div className={styles.progressItem}><i className={styles.done}>✓</i><span>Products</span></div>
          <div className={styles.progressLine} />
          <div className={styles.progressItem}><i className={styles.active}>3</i><span>Brief</span></div>
          <div className={styles.progressLine} />
          <div className={styles.progressItem}><i className={briefReady ? styles.active : ""}>4</i><span>Direction</span></div>
          <div className={styles.progressLine} />
          <div className={styles.progressItem}><i>5</i><span>Builder</span></div>
        </div>

        <div className={styles.headingRow}>
          <div>
            <p className={styles.eyebrow}>Campaign system · {workspace.name}</p>
            <h1>{showForm ? "Give the campaign a sharp brief." : "Choose the creative system."}</h1>
            <p className={styles.lead}>
              {showForm
                ? "Pagevelope uses this brief to constrain the campaign before design work begins. One goal, one audience, one offer."
                : "Three distinct directions are generated from the same brief. Pick one before the visual builder opens."}
            </p>
          </div>
          <div className={styles.campaignPill}><span style={{ background: brand.primary_color }} />{campaign.name}</div>
        </div>

        {errorMessage ? <div className={styles.error}>{errorMessage}</div> : null}
        {query.brief === "1" && !showForm ? <div className={styles.success}>Brief locked in. Three directions are ready.</div> : null}

        {showForm ? (
          <div className={styles.formLayout}>
            <form className={styles.briefCard} action={saveBrief}>
              <div className={styles.sectionHeading}>
                <div><span>01</span><h2>Campaign brief</h2></div>
                <p>Structured inputs only. No prompt soup.</p>
              </div>

              <label className={styles.field}>
                <span>Campaign system</span>
                <select name="campaignSystem" defaultValue={campaign.campaign_system ?? "product-launch"} required>
                  <option value="product-launch">Product launch</option>
                  <option value="collection-editorial">Collection editorial</option>
                  <option value="restock-waitlist">Restock / waitlist</option>
                  <option value="limited-offer">Limited offer</option>
                  <option value="lifecycle-reminder">Lifecycle reminder</option>
                </select>
              </label>

              <label className={styles.field}>
                <span>Primary goal</span>
                <textarea name="goal" rows={4} maxLength={600} defaultValue={campaign.brief_goal ?? ""} placeholder="Example: Launch the new summer collection and move first-week inventory." required />
              </label>

              <div className={styles.twoCol}>
                <label className={styles.field}>
                  <span>Audience</span>
                  <input name="audience" maxLength={300} defaultValue={campaign.brief_audience ?? ""} placeholder="Past buyers, Mumbai, 25–40" required />
                </label>
                <label className={styles.field}>
                  <span>Offer / hook</span>
                  <input name="offer" maxLength={300} defaultValue={campaign.brief_offer ?? ""} placeholder="Early access + free shipping" required />
                </label>
              </div>

              <div className={styles.twoCol}>
                <label className={styles.field}>
                  <span>Voice</span>
                  <input name="tone" maxLength={120} defaultValue={campaign.brief_tone ?? ""} placeholder="Confident, minimal, premium" required />
                </label>
                <label className={styles.field}>
                  <span>Motion level</span>
                  <select name="motionLevel" defaultValue={campaign.brief_motion_level ?? "subtle"} required>
                    <option value="none">None — static only</option>
                    <option value="subtle">Subtle — restrained loops</option>
                    <option value="expressive">Expressive — motion-forward</option>
                  </select>
                </label>
              </div>

              <div className={styles.formFooter}>
                <p>Saving regenerates all three creative directions and clears any previous selection.</p>
                <button type="submit">Generate 3 directions →</button>
              </div>
            </form>

            <aside className={styles.sideCard}>
              <span className={styles.sideKicker}>Campaign discipline</span>
              <h3>What Pagevelope will not do</h3>
              <ul>
                <li>Generate unrestricted HTML</li>
                <li>Mix five campaign goals together</li>
                <li>Use motion without a static fallback</li>
                <li>Open publishing before the QA gates</li>
              </ul>
              <Link href={productsPath(workspaceId, brandId, campaignId)}>← Edit products</Link>
              {briefReady ? <Link href={briefPath(workspaceId, brandId, campaignId)}>Cancel editing</Link> : null}
            </aside>
          </div>
        ) : (
          <>
            <div className={styles.briefSummary}>
              <div><span>System</span><strong>{systemLabels[campaign.campaign_system ?? ""] ?? campaign.campaign_system}</strong></div>
              <div><span>Audience</span><strong>{campaign.brief_audience}</strong></div>
              <div><span>Offer</span><strong>{campaign.brief_offer}</strong></div>
              <div><span>Motion</span><strong>{campaign.brief_motion_level}</strong></div>
              <Link href={productsPath(workspaceId, brandId, campaignId)}>Edit products</Link>
              <Link href={`${briefPath(workspaceId, brandId, campaignId)}?edit=1`}>Edit brief</Link>
            </div>

            <div className={styles.directionGrid}>
              {directions.map((direction) => {
                const meta = directionMeta[direction.key];
                const selected = campaign.selected_direction_key === direction.key;
                return (
                  <article className={`${styles.directionCard} ${selected ? styles.selectedCard : ""}`} key={direction.key}>
                    <div className={styles.directionTop}>
                      <span>{meta.number}</span>
                      <em>{meta.accent}</em>
                    </div>
                    <div className={styles.preview} data-direction={direction.key}>
                      <i style={{ background: brand.primary_color }} />
                      <b>{brand.name}</b>
                      <strong>{direction.title}</strong>
                      <span />
                      <span />
                      <button type="button" tabIndex={-1}>Primary CTA</button>
                    </div>
                    <h2>{direction.title}</h2>
                    <p>{direction.description}</p>
                    <div className={styles.directionMeta}>
                      <span>Layout <strong>{direction.layout}</strong></span>
                      <span>Motion <strong>{direction.motion}</strong></span>
                    </div>
                    <form action={chooseDirection}>
                      <input type="hidden" name="directionKey" value={direction.key} />
                      <button className={styles.chooseButton} type="submit">
                        {selected ? "Selected · Open builder →" : "Use this direction →"}
                      </button>
                    </form>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function briefPath(workspaceId: string, brandId: string, campaignId: string) {
  return `/workspaces/${workspaceId}/brands/${brandId}/campaigns/${campaignId}/brief`;
}

function productsPath(workspaceId: string, brandId: string, campaignId: string) {
  return `/workspaces/${workspaceId}/brands/${brandId}/campaigns/${campaignId}/products`;
}
