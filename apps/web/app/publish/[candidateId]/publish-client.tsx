"use client";

import { useState } from "react";
import styles from "./publish.module.css";

type PublishResult = {
  receiptId?: string;
  templateId?: string;
  templateOperation?: "created" | "updated";
  campaignMessageId?: string | null;
  externalCampaignId?: string | null;
  sourceSha256?: string;
  manifestSha256?: string;
  receipt?: { id: string; external_template_id: string; published_at: string };
  idempotent?: boolean;
  error?: string;
  code?: string;
};

export function PublishClient({ workspaceId, candidateId }: { workspaceId: string; candidateId: string }) {
  const [messageId, setMessageId] = useState("");
  const [state, setState] = useState<"idle" | "publishing" | "success" | "error">("idle");
  const [result, setResult] = useState<PublishResult | null>(null);

  async function publish() {
    if (state === "publishing") return;
    setState("publishing");
    setResult(null);

    try {
      const response = await fetch(`/api/releases/${encodeURIComponent(candidateId)}/publish/klaviyo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, campaignMessageId: messageId.trim() || undefined }),
      });
      const payload = await response.json() as PublishResult;
      setResult(payload);
      setState(response.ok ? "success" : "error");
    } catch {
      setResult({ error: "The publish request could not reach Pagevelope." });
      setState("error");
    }
  }

  return (
    <section className={styles.publishCard}>
      <div>
        <p className={styles.eyebrow}>Human publish action</p>
        <h2>Publish approved HTML to Klaviyo</h2>
        <p className={styles.copy}>
          Pagevelope will re-verify the immutable approved release, create or update a CODE template, and optionally assign it to an existing Klaviyo campaign message. It will not send the campaign.
        </p>
      </div>

      <label className={styles.label}>
        Existing Klaviyo campaign message ID <span>optional</span>
        <input
          className={styles.input}
          value={messageId}
          onChange={(event) => setMessageId(event.target.value)}
          placeholder="Leave blank to publish template only"
          disabled={state === "publishing" || state === "success"}
        />
      </label>

      <button className={styles.primaryButton} type="button" onClick={publish} disabled={state === "publishing" || state === "success"}>
        {state === "publishing" ? "Publishing…" : state === "success" ? "Published" : "Publish to Klaviyo"}
      </button>

      {state === "error" ? (
        <div className={styles.errorBox}>
          <strong>Publish blocked</strong>
          <span>{result?.error ?? "Klaviyo publishing failed."}</span>
          {result?.code ? <small>{result.code}</small> : null}
        </div>
      ) : null}

      {state === "success" ? (
        <div className={styles.successBox}>
          <strong>{result?.idempotent ? "Already published" : "Klaviyo handoff complete"}</strong>
          <span>Template {result?.templateId ?? result?.receipt?.external_template_id ?? "recorded"}</span>
          {result?.templateOperation ? <span>Template {result.templateOperation}</span> : null}
          {result?.campaignMessageId ? <span>Assigned message {result.campaignMessageId}</span> : <span>Template-only publish; no campaign send occurred.</span>}
          {result?.sourceSha256 ? <small>Source {result.sourceSha256.slice(0, 12)}…</small> : null}
        </div>
      ) : null}
    </section>
  );
}
