import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabasePublicConfig } from "@/lib/supabase/env";
import { signOut } from "@/app/auth/actions";
import styles from "./onboarding.module.css";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  if (!getSupabasePublicConfig()) {
    return (
      <main className={styles.shell}>
          <header className={styles.topbar}>
            <div className={styles.brand}><span className={styles.mark}>P</span>Pagevelope</div>
          </header>
          <section className={styles.content}>
             <p>This preview deliberately stays disconnected from production data. Connect Supabase to access the onboarding flow.</p>
          </section>
      </main>
    );
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    redirect("/auth/sign-in");
  }

  const userId = claimsData.claims.sub;

  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id,created_at")
    .eq("created_by", userId)
    .order("created_at", { ascending: true });

  const hasWorkspace = (workspaces ?? []).length > 0;
  const firstWorkspace = hasWorkspace ? workspaces![0] : null;

  let hasBrand = false;
  let firstBrand = null;
  let hasCampaign = false;
  let hasRelease = false;

  if (firstWorkspace) {
    const { data: brands } = await supabase
      .from("brands")
      .select("id,workspace_id,created_at")
      .eq("workspace_id", firstWorkspace.id)
      .order("created_at", { ascending: true });

    hasBrand = (brands ?? []).length > 0;
    firstBrand = hasBrand ? brands![0] : null;

    const { data: campaigns } = await supabase
      .from("campaigns")
      .select("id,workspace_id,brand_id")
      .eq("workspace_id", firstWorkspace.id)
      .order("updated_at", { ascending: false });

    hasCampaign = (campaigns ?? []).length > 0;

    const { data: releases } = await supabase
       .from("release_candidates")
       .select("id")
       .eq("workspace_id", firstWorkspace.id)
       .limit(1);

    hasRelease = (releases ?? []).length > 0;
  }

  if (hasWorkspace && hasBrand && hasCampaign && hasRelease) {
     redirect("/dashboard");
  }

  const completionPercentage = [hasWorkspace, hasBrand, hasCampaign, hasRelease].filter(Boolean).length * 25;

  return (
    <main className={styles.shell}>
        <header className={styles.topbar}>
          <div className={styles.brand}><span className={styles.mark}>P</span>Pagevelope</div>
          <form action={signOut}><button className={styles.signOut} type="submit">Sign out</button></form>
        </header>

        <section className={styles.content}>
           <div className={styles.headingRow}>
              <div>
                 <p className={styles.eyebrow}>Activation</p>
                 <h1 className={styles.title}>Let's get started.</h1>
                 <p className={styles.subtitle}>Complete this first-run checklist to get your workspace set up.</p>
              </div>
              <div className={styles.progressRing}>
                {completionPercentage}% complete
              </div>
           </div>

           <div className={styles.checklist}>
               <div className={`${styles.checklistItem} ${hasWorkspace ? styles.itemCompleted : ""}`}>
                    <div className={styles.checklistStatus}>
                        {hasWorkspace ? <span className={styles.statusIcon}>✓</span> : <span className={styles.statusCircle}></span>}
                    </div>
                    <div className={styles.checklistContent}>
                        <h3>Create a Workspace</h3>
                        <p>Establish a tenant boundary for your team's campaigns and assets.</p>
                        <Link href="/dashboard" className={hasWorkspace ? styles.checklistActionDisabled : styles.checklistAction}>{hasWorkspace ? "Workspace created" : "Create workspace →"}</Link>
                    </div>
               </div>

               <div className={`${styles.checklistItem} ${hasBrand ? styles.itemCompleted : ""}`}>
                    <div className={styles.checklistStatus}>
                        {hasBrand ? <span className={styles.statusIcon}>✓</span> : <span className={styles.statusCircle}></span>}
                    </div>
                    <div className={styles.checklistContent}>
                       <h3>Set up your Brand</h3>
                       <p>Define identity tokens, legal info, and brand colors to be used in rendering.</p>
                       {hasWorkspace ? (
                            <Link href={`/workspaces/${firstWorkspace!.id}/brands/new`} className={hasBrand ? styles.checklistActionDisabled : styles.checklistAction}>{hasBrand ? "Brand configured" : "Set up brand →"}</Link>
                       ) : (
                            <span className={styles.checklistActionDisabled}>Waiting for workspace</span>
                       )}
                    </div>
               </div>

               <div className={`${styles.checklistItem} ${hasCampaign ? styles.itemCompleted : ""}`}>
                    <div className={styles.checklistStatus}>
                        {hasCampaign ? <span className={styles.statusIcon}>✓</span> : <span className={styles.statusCircle}></span>}
                    </div>
                    <div className={styles.checklistContent}>
                        <h3>Create your first Campaign</h3>
                        <p>Draft a campaign, select a product source, set the brief, and choose a creative direction.</p>
                        {hasWorkspace && hasBrand ? (
                             <Link href={`/workspaces/${firstWorkspace!.id}/brands/${firstBrand!.id}`} className={hasCampaign ? styles.checklistActionDisabled : styles.checklistAction}>{hasCampaign ? "Campaign created" : "Draft campaign →"}</Link>
                        ) : (
                             <span className={styles.checklistActionDisabled}>Waiting for brand setup</span>
                        )}
                    </div>
               </div>

               <div className={`${styles.checklistItem}`}>
                    <div className={styles.checklistStatus}>
                         {hasRelease ? <span className={styles.statusIcon}>✓</span> : <span className={styles.statusCircle}></span>}
                    </div>
                    <div className={styles.checklistContent}>
                        <h3>Test send and publish</h3>
                        <p>Open the builder, review your release in Inbox Lab, and test send your first campaign.</p>
                        {hasWorkspace && hasBrand && hasCampaign ? (
                             <Link href={`/workspaces/${firstWorkspace!.id}/brands/${firstBrand!.id}`} className={styles.checklistAction}>Go to campaign →</Link>
                        ) : (
                             <span className={styles.checklistActionDisabled}>Waiting for campaign draft</span>
                        )}
                    </div>
               </div>
           </div>
        </section>
    </main>
  );
}
