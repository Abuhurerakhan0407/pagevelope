import { redirect } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { getSupabasePublicConfig } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import styles from "./dashboard.module.css";

type Workspace = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const configured = Boolean(getSupabasePublicConfig());

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

  const { data, error } = await supabase
    .from("workspaces")
    .select("id,name,slug,created_at")
    .order("created_at", { ascending: true });

  const workspaces = (data ?? []) as Workspace[];

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.brand}><span className={styles.mark}>P</span>Pagevelope</div>
        <form action={signOut}><button className={styles.signOut} type="submit">Sign out</button></form>
      </header>

      <section className={styles.content}>
        <p className={styles.eyebrow}>Your workspaces</p>
        <h1 className={styles.title}>Welcome to Pagevelope.</h1>
        <p className={styles.subtitle}>Workspace access is filtered by Supabase Row Level Security. Brands, campaigns, assets and audit history will inherit the same tenant boundary.</p>

        {error ? (
          <div className={styles.emptyCard}>
            <h2>Could not load workspaces</h2>
            <p>The authenticated session is valid, but the workspace query failed. No cross-tenant fallback is used.</p>
          </div>
        ) : workspaces.length ? (
          <div className={styles.grid}>
            {workspaces.map((workspace) => (
              <article className={styles.card} key={workspace.id}>
                <div className={styles.cardTop}>
                  <h2>{workspace.name}</h2>
                  <span className={styles.badge}>Workspace</span>
                </div>
                <p className={styles.slug}>/{workspace.slug}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.emptyCard}>
            <h2>No workspace yet</h2>
            <p>Your account is authenticated. Workspace creation and onboarding is the next gated platform step.</p>
          </div>
        )}
      </section>
    </main>
  );
}
