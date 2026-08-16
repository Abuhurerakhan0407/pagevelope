import Link from "next/link";
import { redirect } from "next/navigation";
import { getKlaviyoServerConfig } from "@/lib/klaviyo/config";
import { getSupabasePublicConfig } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { PublishClient } from "./publish-client";
import styles from "./publish.module.css";

type PageProps = {
  params: Promise<{ candidateId: string }>;
  searchParams: Promise<{ workspaceId?: string }>;
};

type Candidate = {
  id: string;
  campaign_id: string;
  version_number: number;
  source_sha256: string;
  manifest_sha256: string;
  renderer_version: string;
  qa_status: string;
};

type Campaign = {
  id: string;
  name: string;
  status: string;
  current_version_number: number;
};

type Connection = {
  id: string;
  status: string;
  external_account_id: string;
  external_account_name: string | null;
  scopes: string[];
  connected_at: string;
};

type Receipt = {
  id: string;
  external_template_id: string;
  external_campaign_id: string | null;
  external_message_id: string | null;
  source_sha256: string;
  manifest_sha256: string;
  published_at: string;
};

export const dynamic = "force-dynamic";

export default async function PublishPage({ params, searchParams }: PageProps) {
  const { candidateId } = await params;
  const query = await searchParams;
  const workspaceId = query.workspaceId?.trim() ?? "";
  if (!workspaceId || !getSupabasePublicConfig()) redirect("/dashboard");

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) redirect("/auth/sign-in");

  const candidateResult = await supabase
    .from("campaign_release_candidates")
    .select("id,campaign_id,version_number,source_sha256,manifest_sha256,renderer_version,qa_status")
    .eq("workspace_id", workspaceId)
    .eq("id", candidateId)
    .maybeSingle();
  if (candidateResult.error || !candidateResult.data) redirect("/dashboard");
  const candidate = candidateResult.data as Candidate;

  const [campaignResult, connectionResult, receiptResult] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id,name,status,current_version_number")
      .eq("workspace_id", workspaceId)
      .eq("id", candidate.campaign_id)
      .maybeSingle(),
    supabase
      .from("integration_connections")
      .select("id,status,external_account_id,external_account_name,scopes,connected_at")
      .eq("workspace_id", workspaceId)
      .eq("provider", "klaviyo")
      .maybeSingle(),
    supabase
      .from("campaign_publish_receipts")
      .select("id,external_template_id,external_campaign_id,external_message_id,source_sha256,manifest_sha256,published_at")
      .eq("workspace_id", workspaceId)
      .eq("release_candidate_id", candidateId)
      .maybeSingle(),
  ]);

  if (campaignResult.error || !campaignResult.data) redirect("/dashboard");
  const campaign = campaignResult.data as Campaign;
  const connection = connectionResult.data as Connection | null;
  const receipt = receiptResult.data as Receipt | null;
  const serverConfigured = Boolean(getKlaviyoServerConfig());
  const currentApproved = campaign.status === "approved" && campaign.current_version_number === candidate.version_number;
  const connected = connection?.status === "connected";
  const canPublish = serverConfigured && connected && currentApproved && !receipt;
  const reviewUrl = `/review/${encodeURIComponent(candidateId)}?workspaceId=${encodeURIComponent(workspaceId)}`;
  const connectUrl = `/api/integrations/klaviyo/start?workspaceId=${encodeURIComponent(workspaceId)}`;

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <Link className={styles.brand} href="/dashboard"><span>P</span>Pagevelope</Link>
        <div className={styles.topActions}>
          <Link className={styles.secondaryButton} href={reviewUrl}>Back to review</Link>
          <span className={receipt ? styles.publishedBadge : canPublish ? styles.readyBadge : styles.blockedBadge}>
            {receipt ? "PUBLISHED" : canPublish ? "READY TO PUBLISH" : "PUBLISH BLOCKED"}
          </span>
        </div>
      </header>

      <section className={styles.content}>
        <div className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>Release handoff</p>
            <h1>{campaign.name}</h1>
            <p className={styles.subtitle}>The final Pagevelope gate verifies the exact approved release again before Klaviyo receives production HTML.</p>
          </div>
          <div className={styles.versionCard}>
            <span>Immutable version</span>
            <strong>v{candidate.version_number}</strong>
            <small>{candidate.source_sha256.slice(0, 12)}…</small>
          </div>
        </div>

        <section className={styles.gates}>
          <article><span>Campaign approval</span><strong>{currentApproved ? "PASS" : campaign.status.toUpperCase()}</strong><small>Current version required</small></article>
          <article><span>Renderer QA</span><strong>{candidate.qa_status}</strong><small>Renderer {candidate.renderer_version}</small></article>
          <article><span>Klaviyo connection</span><strong>{connected ? "CONNECTED" : connection?.status?.toUpperCase() ?? "NOT CONNECTED"}</strong><small>{connection?.external_account_name ?? connection?.external_account_id ?? "OAuth required"}</small></article>
          <article><span>Manifest</span><strong className={styles.hash}>{candidate.manifest_sha256.slice(0, 12)}…</strong><small>Reverified at publish</small></article>
        </section>

        {!serverConfigured ? (
          <section className={styles.blockCard}>
            <p className={styles.eyebrow}>Environment gate</p>
            <h2>Klaviyo server configuration is not active here.</h2>
            <p>Publishing remains disabled until the server-only OAuth credentials, encryption key and Supabase service-role variable are configured. No secret belongs in the browser or repository.</p>
          </section>
        ) : !connected ? (
          <section className={styles.connectCard}>
            <div>
              <p className={styles.eyebrow}>Integration</p>
              <h2>Connect this workspace to Klaviyo.</h2>
              <p>Only a workspace owner or admin can authorize the account. Pagevelope requests the narrow account, template and campaign scopes needed for the approved publishing path.</p>
            </div>
            <a className={styles.primaryButton} href={connectUrl}>Connect Klaviyo</a>
          </section>
        ) : null}

        {receipt ? (
          <section className={styles.receiptCard}>
            <p className={styles.eyebrow}>Immutable release receipt</p>
            <h2>Published to Klaviyo.</h2>
            <div className={styles.receiptGrid}>
              <div><span>Template</span><strong>{receipt.external_template_id}</strong></div>
              <div><span>Campaign</span><strong>{receipt.external_campaign_id ?? "Template only"}</strong></div>
              <div><span>Message</span><strong>{receipt.external_message_id ?? "Not assigned"}</strong></div>
              <div><span>Published</span><strong>{new Date(receipt.published_at).toLocaleString("en-IN")}</strong></div>
            </div>
            <small>Source {receipt.source_sha256.slice(0, 16)}… · Manifest {receipt.manifest_sha256.slice(0, 16)}…</small>
          </section>
        ) : canPublish ? (
          <PublishClient workspaceId={workspaceId} candidateId={candidateId} />
        ) : currentApproved ? null : (
          <section className={styles.blockCard}>
            <p className={styles.eyebrow}>Approval gate</p>
            <h2>This release cannot publish yet.</h2>
            <p>Return to release review. Inbox evidence and immutable reviewer approval must finalize the current campaign version first.</p>
            <Link className={styles.primaryButton} href={reviewUrl}>Return to review</Link>
          </section>
        )}

        <section className={styles.safetyNote}>
          <strong>Sending stays in Klaviyo.</strong>
          <span>Pagevelope creates the approved CODE template and can attach it to an existing campaign message. This workflow does not call Klaviyo&apos;s campaign-send endpoint.</span>
        </section>
      </section>
    </main>
  );
}
