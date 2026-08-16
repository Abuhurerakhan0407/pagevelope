import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabasePublicConfig } from "@/lib/supabase/env";
import styles from "../brand.module.css";

type PageProps = {
  params: Promise<{ workspaceId: string; brandId: string }>;
  searchParams: Promise<{ created?: string }>;
};

type Brand = {
  id: string;
  name: string;
  slug: string;
  primary_color: string;
  accent_color: string;
  background_color: string;
  text_color: string;
  font_family: string;
  website_url: string | null;
  company_name: string | null;
  legal_address: string | null;
  onboarding_completed_at: string | null;
};

export const dynamic = "force-dynamic";

export default async function BrandOverviewPage({ params, searchParams }: PageProps) {
  const { workspaceId, brandId } = await params;
  const query = await searchParams;

  if (!getSupabasePublicConfig()) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) {
    redirect("/auth/sign-in");
  }

  const [{ data: workspace }, { data: brandData }] = await Promise.all([
    supabase.from("workspaces").select("id,name,slug").eq("id", workspaceId).maybeSingle(),
    supabase
      .from("brands")
      .select("id,name,slug,primary_color,accent_color,background_color,text_color,font_family,website_url,company_name,legal_address,onboarding_completed_at")
      .eq("workspace_id", workspaceId)
      .eq("id", brandId)
      .maybeSingle(),
  ]);

  if (!workspace || !brandData) {
    redirect("/dashboard");
  }

  const brand = brandData as Brand;
  const initial = brand.name.slice(0, 1).toUpperCase();

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <Link className={styles.brandLink} href="/dashboard"><span className={styles.mark}>P</span>Pagevelope</Link>
        <Link className={styles.backLink} href="/dashboard">← {workspace.name}</Link>
      </header>

      <section className={styles.content}>
        {query.created === "1" ? <p className={styles.message}>Brand system created and tenant-isolated.</p> : null}
        <p className={styles.eyebrow}>Brand system · {workspace.name}</p>

        <div className={styles.brandHero}>
          <div className={styles.brandSwatch} style={{ background: brand.primary_color }}>{initial}</div>
          <div>
            <h1 className={styles.title}>{brand.name}</h1>
            <p className={styles.subtitle}>This is the controlled brand context Pagevelope will use for campaign creation, rendering, approvals and publishing.</p>
          </div>
        </div>

        <div className={styles.layout}>
          <section className={styles.panel}>
            <div className={styles.sectionHead}>
              <h2>Production identity</h2>
              <p>Persisted inside this workspace and protected by tenant RLS.</p>
            </div>

            <div className={styles.metaGrid}>
              <div className={styles.metaCard}><span>Brand slug</span><strong>{brand.slug}</strong></div>
              <div className={styles.metaCard}><span>Typography</span><strong>{brand.font_family}</strong></div>
              <div className={styles.metaCard}><span>Website</span><strong>{brand.website_url ?? "Not set"}</strong></div>
              <div className={styles.metaCard}><span>Legal company</span><strong>{brand.company_name ?? "Not set"}</strong></div>
              <div className={`${styles.metaCard} ${styles.full}`}><span>Legal address</span><strong>{brand.legal_address ?? "Not set"}</strong></div>
            </div>

            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <h2>Renderer tokens</h2>
                <p>Explicit tokens replace arbitrary styling in production email output.</p>
              </div>
              <div className={styles.colorGrid}>
                {[ ["Primary", brand.primary_color], ["Accent", brand.accent_color], ["Background", brand.background_color], ["Text", brand.text_color] ].map(([label, value]) => (
                  <div className={styles.colorField} key={label}>
                    {label}
                    <div className={styles.colorControl}><span className={styles.dot} style={{ background: value, width: 24, height: 24 }} /><strong>{value}</strong></div>
                  </div>
                ))}
              </div>
            </section>
          </section>

          <aside className={styles.side}>
            <div className={styles.summaryCard}>
              <h3>Brand gate</h3>
              <ul className={styles.summaryList}>
                <li><span>Workspace boundary</span><strong>Ready</strong></li>
                <li><span>Identity tokens</span><strong>Ready</strong></li>
                <li><span>Legal sender data</span><strong>{brand.company_name && brand.legal_address ? "Ready" : "Incomplete"}</strong></li>
                <li><span>Logo asset</span><strong>Next</strong></li>
              </ul>
            </div>
            <div className={styles.nextCard}>
              <strong>Next: real campaign persistence</strong>
              <p>The next build gate binds campaigns and immutable versions to this brand instead of the builder&apos;s demo state.</p>
              <Link className={styles.nextButton} href="/builder">Preview current builder</Link>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
