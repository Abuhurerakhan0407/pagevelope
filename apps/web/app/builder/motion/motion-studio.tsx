"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CampaignDocumentV1, ImageValue } from "@pagevelope/editor-schema";
import { validateCampaignDocument } from "@pagevelope/editor-schema";
import { inspectGif, uploadDeliveryAsset } from "@/lib/assets/delivery";
import styles from "./motion-studio.module.css";

type Hydration = {
  campaign: {
    id: string;
    name: string;
    current_version_number: number;
  };
  brand: { id: string; name: string };
  latestVersion: {
    version_number: number;
    source_json: CampaignDocumentV1;
  } | null;
};

type MotionTarget = {
  key: string;
  label: string;
  image: ImageValue;
};

type FormState = {
  gifSrc: string;
  firstFrameSrc: string;
  previewVideoSrc: string;
  byteSize: string;
  frameCount: string;
  durationMs: string;
};

type UploadKind = "gif" | "firstFrame" | "preview";

const EMPTY_FORM: FormState = {
  gifSrc: "",
  firstFrameSrc: "",
  previewVideoSrc: "",
  byteSize: "",
  frameCount: "",
  durationMs: "",
};

function httpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function collectTargets(document: CampaignDocumentV1): MotionTarget[] {
  const targets: MotionTarget[] = [];
  for (const block of document.blocks) {
    if (block.type === "header" && block.logo) {
      targets.push({ key: `${block.id}:logo`, label: `Header · ${block.wordmark || "Logo"}`, image: block.logo });
    }
    if (block.type === "hero" && block.image) {
      targets.push({ key: `${block.id}:hero`, label: `Hero · ${block.heading}`, image: block.image });
    }
    if (block.type === "image") {
      targets.push({ key: `${block.id}:image`, label: `Image · ${block.image.alt || block.id}`, image: block.image });
    }
    if (block.type === "product-grid") {
      for (const product of block.products) {
        targets.push({ key: `${block.id}:product:${product.id}`, label: `Product · ${product.title}`, image: product.image });
      }
    }
    if (block.type === "columns") {
      for (const column of block.columns) {
        for (const child of column.blocks) {
          if (child.type === "image") {
            targets.push({
              key: `${block.id}:column:${column.id}:image:${child.id}`,
              label: `Column image · ${child.image.alt || child.id}`,
              image: child.image,
            });
          }
        }
      }
    }
  }
  return targets;
}

function replaceTargetImage(document: CampaignDocumentV1, key: string, image: ImageValue): CampaignDocumentV1 {
  const next = structuredClone(document);
  for (const block of next.blocks) {
    if (block.type === "header" && `${block.id}:logo` === key) block.logo = image;
    if (block.type === "hero" && `${block.id}:hero` === key) block.image = image;
    if (block.type === "image" && `${block.id}:image` === key) block.image = image;
    if (block.type === "product-grid") {
      for (const product of block.products) {
        if (`${block.id}:product:${product.id}` === key) product.image = image;
      }
    }
    if (block.type === "columns") {
      for (const column of block.columns) {
        for (const child of column.blocks) {
          if (child.type === "image" && `${block.id}:column:${column.id}:image:${child.id}` === key) {
            child.image = image;
          }
        }
      }
    }
  }
  return next;
}

function formFromTarget(target: MotionTarget | undefined): FormState {
  if (!target) return EMPTY_FORM;
  return {
    gifSrc: target.image.motion ? target.image.src : "",
    firstFrameSrc: target.image.motion?.firstFrameSrc ?? "",
    previewVideoSrc: target.image.motion?.previewVideoSrc ?? "",
    byteSize: target.image.motion ? String(target.image.motion.byteSize) : "",
    frameCount: target.image.motion ? String(target.image.motion.frameCount) : "",
    durationMs: target.image.motion ? String(target.image.motion.durationMs) : "",
  };
}

export default function MotionStudio({ workspaceId, campaignId }: { workspaceId: string; campaignId: string }) {
  const [document, setDocument] = useState<CampaignDocumentV1 | null>(null);
  const [campaignName, setCampaignName] = useState("Campaign");
  const [brandName, setBrandName] = useState("Brand");
  const [brandId, setBrandId] = useState("");
  const [version, setVersion] = useState(0);
  const [selectedKey, setSelectedKey] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [state, setState] = useState<"loading" | "ready" | "uploading" | "saving" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!workspaceId || !campaignId) {
      setState("error");
      setMessage("Open Motion Studio from a persisted campaign in the builder.");
      return;
    }

    const controller = new AbortController();
    fetch(`/api/campaigns/${encodeURIComponent(campaignId)}?workspaceId=${encodeURIComponent(workspaceId)}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = (await response.json()) as Hydration | { error?: string };
        if (!response.ok || !("campaign" in payload)) throw new Error("error" in payload ? payload.error : "Campaign could not be loaded.");
        return payload;
      })
      .then((payload) => {
        if (!payload.latestVersion?.source_json) throw new Error("Save a campaign version before adding motion.");
        setDocument(payload.latestVersion.source_json);
        setCampaignName(payload.campaign.name);
        setBrandName(payload.brand.name);
        setBrandId(payload.brand.id);
        setVersion(payload.campaign.current_version_number);
        const first = collectTargets(payload.latestVersion.source_json)[0];
        if (first) {
          setSelectedKey(first.key);
          setForm(formFromTarget(first));
        }
        setState("ready");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setState("error");
        setMessage(error instanceof Error ? error.message : "Campaign could not be loaded.");
      });

    return () => controller.abort();
  }, [workspaceId, campaignId]);

  const targets = useMemo(() => document ? collectTargets(document) : [], [document]);
  const selected = targets.find((target) => target.key === selectedKey) ?? targets[0];
  const motion = selected?.image.motion;
  const byteSize = Number(form.byteSize);
  const frameCount = Number(form.frameCount);
  const durationMs = Number(form.durationMs);
  const payloadStatus = Number.isFinite(byteSize) && byteSize > 5_000_000
    ? "BLOCK"
    : Number.isFinite(byteSize) && byteSize > 2_000_000
      ? "WARN"
      : "PASS";
  const timingWarn = (Number.isFinite(frameCount) && frameCount > 180) || (Number.isFinite(durationMs) && durationMs > 15_000);
  const busy = state === "uploading" || state === "saving";

  function chooseTarget(key: string) {
    setSelectedKey(key);
    setForm(formFromTarget(targets.find((target) => target.key === key)));
    setMessage("");
  }

  async function uploadAsset(kind: UploadKind, file: File | undefined) {
    if (!file || !brandId || busy) return;

    if (kind === "gif" && file.size > 5_000_000) {
      setState("error");
      setMessage("Animated GIF is above Pagevelope's 5 MB release block. Optimize it before upload.");
      return;
    }
    if (kind === "firstFrame" && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setState("error");
      setMessage("First frame must be JPEG, PNG, or WebP.");
      return;
    }
    if (kind === "preview" && file.type !== "video/mp4") {
      setState("error");
      setMessage("Browser preview must be an MP4 file.");
      return;
    }

    setState("uploading");
    setMessage("");
    try {
      if (kind === "gif") {
        const inspection = await inspectGif(file);
        const asset = await uploadDeliveryAsset({ workspaceId, brandId, file });
        setForm((current) => ({
          ...current,
          gifSrc: asset.publicUrl,
          byteSize: String(asset.byteSize),
          frameCount: String(inspection.frameCount),
          durationMs: String(inspection.durationMs),
        }));
        setMessage(`GIF verified and uploaded · ${inspection.frameCount} frames · ${inspection.durationMs} ms loop.`);
      } else {
        const asset = await uploadDeliveryAsset({ workspaceId, brandId, file });
        setForm((current) => kind === "firstFrame"
          ? { ...current, firstFrameSrc: asset.publicUrl }
          : { ...current, previewVideoSrc: asset.publicUrl });
        setMessage(kind === "firstFrame" ? "Static first frame uploaded." : "Browser preview video uploaded.");
      }
      setState("ready");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Asset upload failed.");
    }
  }

  async function persist(nextDocument: CampaignDocumentV1, successMessage: string) {
    const validation = validateCampaignDocument(nextDocument);
    if (!validation.success) {
      setState("error");
      setMessage(validation.issues.slice(0, 3).map((issue) => `${issue.path}: ${issue.message}`).join(" · "));
      return;
    }

    setState("saving");
    setMessage("");
    try {
      const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, expectedVersion: version, source: nextDocument }),
      });
      const payload = (await response.json()) as { version?: number; error?: string };
      if (!response.ok || typeof payload.version !== "number") throw new Error(payload.error || "Motion version could not be saved.");
      setDocument(nextDocument);
      setVersion(payload.version);
      setState("ready");
      setMessage(successMessage);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Motion version could not be saved.");
    }
  }

  async function attachMotion() {
    if (!document || !selected) return;
    const gifSrc = form.gifSrc.trim();
    const firstFrameSrc = form.firstFrameSrc.trim();
    const previewVideoSrc = form.previewVideoSrc.trim();
    const bytes = Number(form.byteSize);
    const frames = Number(form.frameCount);
    const duration = Number(form.durationMs);

    if (!httpsUrl(gifSrc) || !httpsUrl(firstFrameSrc) || gifSrc === firstFrameSrc) {
      setState("error");
      setMessage("Upload a verified GIF and a separate static first frame before saving motion.");
      return;
    }
    if (previewVideoSrc && !httpsUrl(previewVideoSrc)) {
      setState("error");
      setMessage("Browser preview video must use HTTPS.");
      return;
    }
    if (!Number.isInteger(bytes) || bytes < 1 || bytes > 5_000_000 || !Number.isInteger(frames) || frames < 2 || !Number.isInteger(duration) || duration < 1) {
      setState("error");
      setMessage("Verified GIF evidence is incomplete or outside the release limits.");
      return;
    }

    const nextImage: ImageValue = {
      ...selected.image,
      src: gifSrc,
      motion: {
        kind: "gif",
        firstFrameSrc,
        ...(previewVideoSrc ? { previewVideoSrc } : {}),
        byteSize: bytes,
        frameCount: frames,
        durationMs: duration,
        loop: true,
      },
    };
    await persist(replaceTargetImage(document, selected.key, nextImage), "Safe motion attached as a new immutable campaign version.");
  }

  async function removeMotion() {
    if (!document || !selected?.image.motion) return;
    const { motion: currentMotion, ...staticImage } = selected.image;
    const nextImage: ImageValue = { ...staticImage, src: currentMotion.firstFrameSrc };
    await persist(replaceTargetImage(document, selected.key, nextImage), "Motion removed. The proven first frame is now the static production image.");
  }

  const builderHref = workspaceId && brandId && campaignId
    ? `/builder?workspaceId=${encodeURIComponent(workspaceId)}&brandId=${encodeURIComponent(brandId)}&campaignId=${encodeURIComponent(campaignId)}`
    : "/builder";

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <Link className={styles.brand} href="/dashboard"><span>P</span>Pagevelope</Link>
        <div className={styles.topMeta}><strong>{campaignName}</strong><span>{brandName} · immutable v{version}</span></div>
        <Link className={styles.back} href={builderHref}>Back to builder</Link>
      </header>

      <section className={styles.page}>
        <div className={styles.hero}>
          <div><p>Motion Studio · safe email motion</p><h1>Animate without gambling on the inbox.</h1><span>Upload the GIF and first frame. Pagevelope hashes the files, measures the animation, stores immutable delivery assets, and keeps Outlook on the proven static fallback.</span></div>
          <div className={styles.score}><span>Payload gate</span><strong className={payloadStatus === "BLOCK" ? styles.block : payloadStatus === "WARN" ? styles.warn : styles.pass}>{payloadStatus}</strong><small>{timingWarn ? "Timing optimization recommended" : "Timing within preferred range"}</small></div>
        </div>

        {message ? <div className={state === "error" ? styles.error : styles.success}>{message}</div> : null}

        <div className={styles.layout}>
          <aside className={styles.targets}>
            <div className={styles.sectionHead}><span>01</span><div><h2>Media targets</h2><p>{targets.length} image assets in this version</p></div></div>
            {targets.length ? targets.map((target) => (
              <button key={target.key} type="button" className={target.key === selected?.key ? styles.targetActive : styles.target} onClick={() => chooseTarget(target.key)}>
                <span>{target.image.motion ? "GIF" : "IMG"}</span><strong>{target.label}</strong><small>{target.image.motion ? "Motion attached" : "Static"}</small>
              </button>
            )) : <p className={styles.empty}>This saved campaign has no editable image assets yet.</p>}
          </aside>

          <section className={styles.previewPanel}>
            <div className={styles.sectionHead}><span>02</span><div><h2>Fallback proof</h2><p>Compare what modern clients and Outlook receive.</p></div></div>
            {selected ? (
              <div className={styles.previewGrid}>
                <article><div className={styles.previewLabel}><span>Animated</span><b>GIF / capable clients</b></div><div className={styles.imageStage}>{form.gifSrc ? <img src={form.gifSrc} alt={selected.image.alt} /> : <span className={styles.placeholder}>Upload an animated GIF.</span>}</div></article>
                <article><div className={styles.previewLabel}><span>Static</span><b>Outlook first frame</b></div><div className={styles.imageStage}>{form.firstFrameSrc ? <img src={form.firstFrameSrc} alt={`${selected.image.alt} static fallback`} /> : <span className={styles.placeholder}>Upload a separate first frame.</span>}</div></article>
              </div>
            ) : <div className={styles.placeholder}>Select a saved campaign image.</div>}
          </section>

          <aside className={styles.controls}>
            <div className={styles.sectionHead}><span>03</span><div><h2>Motion evidence</h2><p>Pick files; Pagevelope generates the evidence automatically.</p></div></div>
            {selected ? (
              <div className={styles.form}>
                <label className={styles.filePicker}><span>Animated GIF</span><input type="file" accept="image/gif" disabled={busy} onChange={(event) => void uploadAsset("gif", event.target.files?.[0])} /><small>Required · infinite-loop GIF · max 5 MB</small></label>
                <label className={styles.filePicker}><span>Static first frame</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => void uploadAsset("firstFrame", event.target.files?.[0])} /><small>Required · meaningful Outlook fallback</small></label>
                <label className={styles.filePicker}><span>Browser preview video <em>optional</em></span><input type="file" accept="video/mp4" disabled={busy} onChange={(event) => void uploadAsset("preview", event.target.files?.[0])} /><small>Optional · preview only, never embedded in email</small></label>

                <div className={styles.assetEvidence}>
                  <span><b>GIF</b>{form.gifSrc ? "Uploaded" : "Missing"}</span>
                  <span><b>First frame</b>{form.firstFrameSrc ? "Uploaded" : "Missing"}</span>
                  <span><b>Preview</b>{form.previewVideoSrc ? "Uploaded" : "Optional"}</span>
                </div>

                <div className={styles.metricGrid}>
                  <label><span>Bytes</span><input readOnly value={form.byteSize} placeholder="Measured on upload" /></label>
                  <label><span>Frames</span><input readOnly value={form.frameCount} placeholder="Measured" /></label>
                  <label><span>Duration ms</span><input readOnly value={form.durationMs} placeholder="Measured" /></label>
                </div>
                <div className={styles.rules}><span>✓ SHA-256 immutable URLs</span><span>✓ Infinite loop verified</span><span>Warn &gt; 2 MB</span><span>Block &gt; 5 MB</span><span>Warn &gt; 180 frames / 15s</span></div>
                <button className={styles.primary} type="button" disabled={busy || !form.gifSrc || !form.firstFrameSrc} onClick={attachMotion}>{state === "uploading" ? "Uploading evidence…" : state === "saving" ? "Saving version…" : motion ? "Update safe motion" : "Attach safe motion"}</button>
                {motion ? <button className={styles.remove} type="button" disabled={busy} onClick={removeMotion}>Remove motion → use first frame</button> : null}
              </div>
            ) : null}
          </aside>
        </div>
      </section>
    </main>
  );
}
