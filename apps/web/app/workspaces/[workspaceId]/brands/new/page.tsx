import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabasePublicConfig } from "@/lib/supabase/env";
import { createBrand } from "./actions";
import styles from "../brand.module.css";

type PageProps = {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ error?: string }>;
};

const errorMessages: Record<string, string> = {
  "supabase-not-configured": "This environment is not connected to Supabase yet.",
  "invalid-brand": "Check the brand name, colors, website URL and legal information.",
  "brand-create-failed": "The brand could not be created. The slug may already exist or your role may not allow edits.",
};

export const dynamic = "force-dynamic";

export default async function NewBrandPage({ params, searchParams }: PageProps) {
  const { workspaceId } = await params;
  const query = await searchParams;

  if (!getSupabasePublicConfig()) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) {
    redirect("/auth/sign-in");
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id,name,slug")
    .eq("id", workspaceId)
    .maybeSingle();

  if (!workspace) {
    redirect("/dashboard");
  }

  const errorMessage = query.error ? errorMessages[query.error] : null;
  const boundCreateBrand = createBrand.bind(null, workspaceId);

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <Link className={styles.brandLink} href="/dashboard"><span className={styles.mark}>P</span>Pagevelope</Link>
        <Link className={styles.backLink} href="/dashboard">← Back to {workspace.name}</Link>
      </header>

      <section className={styles.content}>
        <p className={styles.eyebrow}>Brand system · {workspace.name}</p>
        <h1 className={styles.title}>Give Pagevelope the rules of your brand.</h1>
        <p className={styles.subtitle}>These identity tokens become controlled inputs for campaign generation and the deterministic email renderer. They are not decorative profile fields.</p>

        {errorMessage ? <p className={`${styles.message} ${styles.error}`}>{errorMessage}</p> : null}

        <div className={styles.layout}>
          <form className={styles.panel} action={boundCreateBrand}>
            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <h2>Brand identity</h2>
                <p>The minimum identity Pagevelope needs before a campaign can be production-ready.</p>
              </div>
              <div className={styles.formGrid}>
                <label className={styles.label}>
                  Brand name
                  <input className={styles.input} name="name" type="text" maxLength={160} placeholder="Northstar" required />
                </label>
                <label className={styles.label}>
                  Brand slug
                  <input className={styles.input} name="slug" type="text" maxLength={80} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="northstar" />
                </label>
                <label className={styles.label}>
                  Typography
                  <select className={styles.select} name="fontFamily" defaultValue="Inter">
                    <option value="Inter">Inter</option>
                    <option value="Arial">Arial</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Helvetica">Helvetica</option>
                    <option value="Verdana">Verdana</option>
                  </select>
                </label>
                <label className={styles.label}>
                  Website
                  <input className={styles.input} name="websiteUrl" type="url" placeholder="https://brand.com" />
                </label>
              </div>
              <p className={styles.hint}>Leave the brand slug blank and Pagevelope generates one from the brand name.</p>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <h2>Color system</h2>
                <p>Safe, explicit hex tokens. The renderer receives these values instead of arbitrary CSS.</p>
              </div>
              <div className={styles.colorGrid}>
                <label className={styles.colorField}>Primary
                  <div className={styles.colorControl}><input name="primaryColor" type="color" defaultValue="#6F5CFB" /><span>#6F5CFB</span></div>
                </label>
                <label className={styles.colorField}>Accent
                  <div className={styles.colorControl}><input name="accentColor" type="color" defaultValue="#A78BFA" /><span>#A78BFA</span></div>
                </label>
                <label className={styles.colorField}>Background
                  <div className={styles.colorControl}><input name="backgroundColor" type="color" defaultValue="#FFFFFF" /><span>#FFFFFF</span></div>
                </label>
                <label className={styles.colorField}>Text
                  <div className={styles.colorControl}><input name="textColor" type="color" defaultValue="#0F1221" /><span>#0F1221</span></div>
                </label>
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <h2>Legal sender identity</h2>
                <p>Email production needs a real company identity and postal address before publishing.</p>
              </div>
              <div className={styles.formGrid}>
                <label className={`${styles.label} ${styles.full}`}>
                  Legal company name
                  <input className={styles.input} name="companyName" type="text" maxLength={160} placeholder="Northstar Commerce Pvt Ltd" />
                </label>
                <label className={`${styles.label} ${styles.full}`}>
                  Postal / legal address
                  <textarea className={styles.textarea} name="legalAddress" maxLength={500} placeholder="Office / street, city, state, postal code, country" />
                </label>
              </div>
            </section>

            <button className={styles.primaryButton} type="submit">Save brand system</button>
          </form>

          <aside className={styles.side}>
            <div className={styles.previewCard}>
              <p className={styles.eyebrow}>Campaign preview</p>
              <div className={styles.previewWindow}>
                <div className={styles.previewTop}><span className={styles.dot} /><span className={styles.dot} /><span className={styles.dot} /></div>
                <div className={styles.previewBody}>
                  <div className={styles.previewLogo}>N</div>
                  <h3>Your next drop.</h3>
                  <p>Identity tokens flow into every controlled Pagevelope campaign system.</p>
                  <span className={styles.previewCta}>Shop the release</span>
                </div>
              </div>
            </div>
            <div className={styles.summaryCard}>
              <h3>What this unlocks</h3>
              <ul className={styles.summaryList}>
                <li><span>Visual Builder</span><strong>Brand tokens</strong></li>
                <li><span>Email renderer</span><strong>Legal identity</strong></li>
                <li><span>Creative systems</span><strong>Consistent output</strong></li>
                <li><span>Publishing</span><strong>Safer defaults</strong></li>
              </ul>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
