import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { createWorkspace } from "./actions";
import { getSupabasePublicConfig } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import styles from "./dashboard.module.css";

type Workspace = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
};

type Brand = {
  id: string;
  workspace_id: string;
  name: string;
};

type DashboardPageProps = {
  searchParams: Promise<{ error?: string; created?: string }>;
};

const errorMessages: Record<string, string> = {
  "supabase-not-configured": "Workspace creation is unavailable until this environment is connected to Supabase.",
  "invalid-workspace": "Enter a workspace name and use a valid URL slug.",
  "workspace-create-failed": "We could not create that workspace. The slug may already be in use.",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const configured = Boolean(getSupabasePublicConfig());
  const params = await searchParams;

  if (!configured) {
    return (
      <main className={styles.shell}>
        <header className={styles.topbar}>
          <div className={styles.brand}><span className={styles.mark}>P</span>Pagevelope</div>
        </header>
        <section className={styles.content}>
          <p className={styles.eyebrow}>Platform foundation</p>
          <h1 className={styles.title}>The workspace layer is ready.</h1>
          <p className={styles.subtitle}>This preview deliberately stays disconnected from production data. Once a Supabase project is connected, the same route becomes an authenticated, RLS-protected dashboard.</p>
          <div className={styles.setupCard}>
            <h2>Supabase connection pending</h2>
            <p>No secret is embedded in the codebase. The app activates cookie-based authentication only when the environment contains the public project URL and publishable key.</p>
            <div className={styles.setupCode}>
              <span>NEXT_PUBLIC_SUPABASE_URL</span>
              <span>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</span>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    redirect("/auth/sign-in");
  }

  const [{ data: workspaceData, error }, { data: brandData }] = await Promise.all([
    supabase.from("workspaces").select("id,name,slug,created_at").order("created_at", { ascending: true }),
    supabase.from("brands").select("id,workspace_id,name").order("created_at", { ascending: true }),
  ]);

  const workspaces = (workspaceData ?? []) as Workspace[];
  const brands = (brandData ?? []) as Brand[];
  const firstBrandByWorkspace = new Map<string, Brand>();
  for (const brand of brands) {
    if (!firstBrandByWorkspace.has(brand.workspace_id)) firstBrandByWorkspace.set(brand.workspace_id, brand);
  }

  const errorMessage = params.error ? errorMessages[params.error] : null;
  const createdMessage = params.created === "1" ? "Workspace created. You are its owner." : null;

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.brand}><span className={styles.mark}>P</span>Pagevelope</div>
        <form action={signOut}><button className={styles.signOut} type="submit">Sign out</button></form>
      </header>

      <section className={styles.content}>
        <div className={styles.headingRow}>
          <div>
            <p className={styles.eyebrow}>Your workspaces</p>
            <h1 className={styles.title}>Welcome to Pagevelope.</h1>
            <p className={styles.subtitle}>Workspace access is filtered by Supabase Row Level Security. Brands, campaigns, assets and audit history inherit the same tenant boundary.</p>
          </div>
          <div className={styles.securityPill}>RLS protected</div>
        </div>

        {errorMessage ? <p className={`${styles.message} ${styles.error}`}>{errorMessage}</p> : null}
        {createdMessage ? <p className={styles.message}>{createdMessage}</p> : null}

        <div className={styles.workspaceLayout}>
          <section>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.sectionLabel}>Available now</p>
                <h2>Choose a workspace</h2>
              </div>
              <span>{workspaces.length} total</span>
            </div>

            {error ? (
              <div className={styles.emptyCard}>
                <h2>Could not load workspaces</h2>
                <p>The authenticated session is valid, but the workspace query failed. No cross-tenant fallback is used.</p>
              </div>
            ) : workspaces.length ? (
              <div className={styles.grid}>
                {workspaces.map((workspace) => {
                  const brand = firstBrandByWorkspace.get(workspace.id);
                  const href = brand
                    ? `/workspaces/${workspace.id}/brands/${brand.id}`
                    : `/workspaces/${workspace.id}/brands/new`;
                  return (
                    <article className={styles.card} key={workspace.id}>
                      <div className={styles.cardTop}>
                        <h2>{workspace.name}</h2>
                        <span className={styles.badge}>Workspace</span>
                      </div>
                      <p className={styles.slug}>/{workspace.slug}</p>
                      <div className={styles.cardMeta}>
                        <span>{brand ? `Brand · ${brand.name}` : "No brand configured"}</span>
                        <Link className={styles.cardAction} href={href}>{brand ? "Open brand →" : "Set up brand →"}</Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className={styles.emptyCard}>
                <h2>No workspace yet</h2>
                <p>Create your first workspace to establish the tenant boundary for brands, campaigns, assets, approvals and publishing.</p>
              </div>
            )}
          </section>

          <aside className={styles.createCard}>
            <p className={styles.sectionLabel}>New workspace</p>
            <h2>Start your production space.</h2>
            <p className={styles.createCopy}>Use your agency, brand team, or company name. Pagevelope creates the workspace, owner membership, and audit event atomically.</p>
            <form className={styles.form} action={createWorkspace}>
              <label className={styles.label}>
                Workspace name
                <input className={styles.input} name="name" type="text" maxLength={120} placeholder="Northstar Studio" required />
              </label>
              <label className={styles.label}>
                Workspace URL slug
                <div className={styles.slugInputWrap}>
                  <span>pagevelope/</span>
                  <input className={styles.slugInput} name="slug" type="text" maxLength={80} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="northstar-studio" />
                </div>
              </label>
              <p className={styles.hint}>Leave the slug blank and Pagevelope will generate it from the workspace name.</p>
              <button className={styles.primaryButton} type="submit">Create workspace</button>
            </form>
          </aside>
        </div>
      </section>
    </main>
  );
}
