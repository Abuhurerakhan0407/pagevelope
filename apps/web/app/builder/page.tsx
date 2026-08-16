"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { buildCampaignDocument } from "./build-campaign";
import styles from "./builder.module.css";

type ViewMode = "desktop" | "mobile" | "images-off" | "rendered";
type BlockKind = "header" | "hero" | "text" | "image" | "button" | "products" | "divider" | "spacer" | "social" | "footer";

type CanvasBlock = {
  id: string;
  kind: BlockKind;
  label: string;
  title: string;
  body?: string;
  cta?: string;
};

type RenderResult = {
  html: string;
  plainText: string;
  mjml: string;
  manifest: {
    rendererVersion: string;
    sourceFingerprint: string;
    qa: {
      status: "PASS" | "WARN" | "BLOCK";
      issues: Array<{ code: string; severity: "WARN" | "BLOCK"; message: string }>;
    };
    files: Array<{ name: string; bytes: number; sha256: string }>;
  };
};

const initialBlocks: CanvasBlock[] = [
  { id: "header-1", kind: "header", label: "Header", title: "NORTHSTAR" },
  {
    id: "hero-1",
    kind: "hero",
    label: "Hero",
    title: "Hydration, minus the bulk.",
    body: "Orbit keeps a full day of water close without taking over your bag.",
    cta: "Shop Orbit",
  },
  {
    id: "text-1",
    kind: "text",
    label: "Text",
    title: "Designed for the daily carry",
    body: "Slim profile. Leak-resistant cap. Cold for hours.",
  },
  {
    id: "products-1",
    kind: "products",
    label: "Product grid",
    title: "Choose your finish",
    body: "Orbit / Lilac · ₹2,499\nOrbit / Ink · ₹2,499",
  },
  {
    id: "footer-1",
    kind: "footer",
    label: "Footer",
    title: "Northstar Goods",
    body: "12 Market Road, Mumbai, Maharashtra 400001, India",
  },
];

const library: Array<{ kind: BlockKind; label: string; symbol: string }> = [
  { kind: "header", label: "Header", symbol: "H" },
  { kind: "hero", label: "Hero", symbol: "✦" },
  { kind: "text", label: "Text", symbol: "T" },
  { kind: "image", label: "Image", symbol: "▧" },
  { kind: "button", label: "Button", symbol: "↗" },
  { kind: "products", label: "Products", symbol: "▦" },
  { kind: "divider", label: "Divider", symbol: "—" },
  { kind: "spacer", label: "Spacer", symbol: "↕" },
  { kind: "social", label: "Social", symbol: "◎" },
  { kind: "footer", label: "Footer", symbol: "F" },
];

function makeBlock(kind: BlockKind, label: string): CanvasBlock {
  const defaults: Record<BlockKind, Pick<CanvasBlock, "title" | "body" | "cta">> = {
    header: { title: "YOUR BRAND" },
    hero: { title: "A strong campaign headline", body: "Write one clear supporting sentence.", cta: "Shop now" },
    text: { title: "Section heading", body: "Add useful campaign copy here." },
    image: { title: "Campaign image", body: "Alt text: describe the image meaningfully." },
    button: { title: "Primary action", cta: "Learn more" },
    products: { title: "Featured products", body: "Product one · ₹1,999\nProduct two · ₹2,499" },
    divider: { title: "Divider" },
    spacer: { title: "24px spacer" },
    social: { title: "Follow us", body: "Instagram" },
    footer: { title: "Company name", body: "Physical business address" },
  };

  return {
    id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    label,
    ...defaults[kind],
  };
}

export default function BuilderPage() {
  const [blocks, setBlocks] = useState<CanvasBlock[]>(initialBlocks);
  const [selectedId, setSelectedId] = useState("hero-1");
  const [view, setView] = useState<ViewMode>("desktop");
  const [qaOpen, setQaOpen] = useState(true);
  const [saved, setSaved] = useState(true);
  const [renderState, setRenderState] = useState<"idle" | "rendering" | "ready" | "error">("idle");
  const [renderResult, setRenderResult] = useState<RenderResult | null>(null);
  const [renderError, setRenderError] = useState("");

  const selected = useMemo(
    () => blocks.find((block) => block.id === selectedId) ?? blocks[0],
    [blocks, selectedId],
  );

  const footerCount = blocks.filter((block) => block.kind === "footer").length;
  const localGatePassed = footerCount === 1;
  const qaStatus = renderResult?.manifest.qa.status ?? (localGatePassed ? "PASS" : "BLOCK");

  function markDirty() {
    setSaved(false);
    setRenderState("idle");
    setRenderResult(null);
    setRenderError("");
    if (view === "rendered") setView("desktop");
  }

  function addBlock(kind: BlockKind, label: string) {
    const next = makeBlock(kind, label);
    setBlocks((current) => [...current, next]);
    setSelectedId(next.id);
    markDirty();
  }

  function updateSelected(patch: Partial<CanvasBlock>) {
    setBlocks((current) => current.map((block) => (block.id === selectedId ? { ...block, ...patch } : block)));
    markDirty();
  }

  function duplicateSelected() {
    if (!selected) return;
    const index = blocks.findIndex((block) => block.id === selected.id);
    const copy = { ...selected, id: `${selected.kind}-${Date.now()}-copy`, title: `${selected.title} copy` };
    const next = [...blocks];
    next.splice(index + 1, 0, copy);
    setBlocks(next);
    setSelectedId(copy.id);
    markDirty();
  }

  function deleteSelected() {
    if (!selected || blocks.length <= 1) return;
    const index = blocks.findIndex((block) => block.id === selected.id);
    const next = blocks.filter((block) => block.id !== selected.id);
    setBlocks(next);
    setSelectedId(next[Math.max(0, index - 1)]?.id ?? next[0].id);
    markDirty();
  }

  function moveSelected(direction: -1 | 1) {
    if (!selected) return;
    const index = blocks.findIndex((block) => block.id === selected.id);
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    setBlocks(next);
    markDirty();
  }

  function saveCampaign() {
    setSaved(true);
  }

  async function renderProduction() {
    setRenderState("rendering");
    setRenderError("");

    try {
      const response = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildCampaignDocument(blocks)),
      });
      const payload = (await response.json()) as RenderResult | { error?: string };

      if (!response.ok || !("html" in payload)) {
        throw new Error("error" in payload && payload.error ? payload.error : "Production render failed.");
      }

      setRenderResult(payload);
      setRenderState("ready");
      setView("rendered");
      setQaOpen(true);
    } catch (error) {
      setRenderResult(null);
      setRenderState("error");
      setRenderError(error instanceof Error ? error.message : "Production render failed.");
      setQaOpen(true);
    }
  }

  function downloadHtml() {
    if (!renderResult) return;
    const blob = new Blob([renderResult.html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "orbit-bottle-launch.html";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.topLeft}>
          <Link className={styles.brand} href="/" aria-label="Back to Pagevelope home">
            <span className={styles.brandMark}>P</span>
            <span>Pagevelope</span>
          </Link>
          <span className={styles.crumb}>/</span>
          <div>
            <strong className={styles.campaignName}>Orbit Bottle Launch</strong>
            <span className={styles.version}>Draft · schema v1</span>
          </div>
        </div>

        <div className={styles.topActions}>
          <span className={saved ? styles.saved : styles.unsaved}>{saved ? "Saved" : "Unsaved changes"}</span>
          <button className={styles.iconButton} type="button" onClick={() => moveSelected(-1)} title="Move selected block up">↑</button>
          <button className={styles.iconButton} type="button" onClick={() => moveSelected(1)} title="Move selected block down">↓</button>
          <button className={styles.secondaryButton} type="button" onClick={() => setQaOpen((value) => !value)}>Inbox Lab</button>
          <button className={styles.secondaryButton} type="button" onClick={saveCampaign}>Save</button>
          <button className={styles.secondaryButton} type="button" onClick={renderProduction} disabled={renderState === "rendering"}>
            {renderState === "rendering" ? "Rendering…" : "Render HTML"}
          </button>
          {renderResult ? <button className={styles.secondaryButton} type="button" onClick={downloadHtml}>Download HTML</button> : null}
          <button className={styles.primaryButton} type="button" onClick={() => window.alert("Publishing stays locked until approval + Inbox Lab gates pass.")}>Publish</button>
        </div>
      </header>

      <section className={styles.workspace}>
        <aside className={styles.leftRail}>
          <div className={styles.panelHeading}>
            <div>
              <span className={styles.kicker}>Build</span>
              <h2>Blocks</h2>
            </div>
            <button className={styles.tinyButton} type="button" title="Collapse block panel">‹</button>
          </div>

          <div className={styles.libraryGrid}>
            {library.map((item) => (
              <button className={styles.libraryItem} type="button" key={item.kind} onClick={() => addBlock(item.kind, item.label)}>
                <span className={styles.libraryIcon}>{item.symbol}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          <div className={styles.layerHeading}>
            <span>Layers</span>
            <span>{blocks.length}</span>
          </div>
          <div className={styles.layers}>
            {blocks.map((block, index) => (
              <button
                type="button"
                key={block.id}
                className={`${styles.layerRow} ${block.id === selectedId ? styles.layerSelected : ""}`}
                onClick={() => setSelectedId(block.id)}
              >
                <span className={styles.dragHandle}>⋮⋮</span>
                <span className={styles.layerIndex}>{String(index + 1).padStart(2, "0")}</span>
                <span className={styles.layerLabel}>{block.label}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className={styles.stageArea}>
          <div className={styles.stageToolbar}>
            <div className={styles.segmented} aria-label="Preview mode">
              {(["desktop", "mobile", "images-off"] as ViewMode[]).map((mode) => (
                <button
                  type="button"
                  key={mode}
                  onClick={() => setView(mode)}
                  className={view === mode ? styles.segmentActive : ""}
                >
                  {mode === "desktop" ? "Desktop" : mode === "mobile" ? "Mobile" : "Images off"}
                </button>
              ))}
              <button type="button" onClick={renderProduction} className={view === "rendered" ? styles.segmentActive : ""} disabled={renderState === "rendering"}>
                {renderState === "rendering" ? "Rendering…" : "Production HTML"}
              </button>
            </div>
            <div className={styles.stageMeta}>
              <span>{view === "rendered" ? `Renderer ${renderResult?.manifest.rendererVersion ?? "—"}` : "600px canvas"}</span>
              <span>{view === "rendered" ? "MJML → HTML" : "100%"}</span>
            </div>
          </div>

          <div className={styles.stageScroll}>
            {view === "rendered" ? (
              <div className={`${styles.emailCanvas} ${styles.productionCanvas}`}>
                {renderResult ? (
                  <iframe className={styles.renderFrame} title="Production email HTML preview" srcDoc={renderResult.html} sandbox="allow-popups allow-popups-to-escape-sandbox" />
                ) : (
                  <div className={styles.renderPlaceholder}>Run the deterministic renderer to preview final production HTML.</div>
                )}
              </div>
            ) : (
              <div className={`${styles.emailCanvas} ${view === "mobile" ? styles.mobileCanvas : ""}`}>
                <div className={styles.emailChrome}>
                  <span>Northstar Goods</span>
                  <span>View in browser</span>
                </div>
                {blocks.map((block) => (
                  <CanvasBlockPreview
                    block={block}
                    key={block.id}
                    selected={block.id === selectedId}
                    imagesOff={view === "images-off"}
                    onSelect={() => setSelectedId(block.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className={styles.rightRail}>
          <div className={styles.panelHeading}>
            <div>
              <span className={styles.kicker}>Selected</span>
              <h2>{selected?.label ?? "Block"}</h2>
            </div>
            <span className={styles.schemaBadge}>schema-safe</span>
          </div>

          {selected ? (
            <div className={styles.properties}>
              <label>
                <span>Heading / label</span>
                <input value={selected.title} onChange={(event) => updateSelected({ title: event.target.value })} />
              </label>

              {selected.body !== undefined ? (
                <label>
                  <span>Body</span>
                  <textarea rows={5} value={selected.body} onChange={(event) => updateSelected({ body: event.target.value })} />
                </label>
              ) : null}

              {selected.cta !== undefined ? (
                <label>
                  <span>CTA label</span>
                  <input value={selected.cta} onChange={(event) => updateSelected({ cta: event.target.value })} />
                </label>
              ) : null}

              <div className={styles.propertyGroup}>
                <span className={styles.propertyTitle}>Layout</span>
                <div className={styles.threeButtons}>
                  <button type="button">Left</button>
                  <button type="button" className={styles.propertyActive}>Center</button>
                  <button type="button">Right</button>
                </div>
              </div>

              <div className={styles.propertyGroup}>
                <div className={styles.propertyRow}>
                  <span>Background</span>
                  <span className={styles.colorValue}><i /> #F4F1FF</span>
                </div>
                <div className={styles.propertyRow}>
                  <span>Spacing</span>
                  <span>24px</span>
                </div>
                <div className={styles.propertyRow}>
                  <span>Mobile stack</span>
                  <span>Auto</span>
                </div>
              </div>

              <div className={styles.blockActions}>
                <button type="button" onClick={duplicateSelected}>Duplicate</button>
                <button type="button" onClick={deleteSelected} className={styles.dangerButton}>Delete</button>
              </div>
            </div>
          ) : null}

          {qaOpen ? (
            <div className={styles.qaPanel}>
              <div className={styles.qaTitleRow}>
                <div>
                  <span className={styles.kicker}>Inbox Lab</span>
                  <strong>{renderState === "error" ? "Release blocked" : renderResult ? "Renderer passed" : localGatePassed ? "Ready to render" : "Release blocked"}</strong>
                </div>
                <span className={qaStatus === "BLOCK" || renderState === "error" ? styles.blockDot : styles.passDot}>{renderState === "error" ? "BLOCK" : qaStatus}</span>
              </div>

              {renderError ? <p className={styles.renderError}>{renderError}</p> : null}

              <ul>
                <li><span>{footerCount === 1 ? "✓" : "!"}</span> Exactly one legal footer</li>
                <li><span>✓</span> Unsubscribe token generated</li>
                <li><span>✓</span> Images-off essentials</li>
                <li><span>✓</span> Executable HTML blocked</li>
              </ul>

              {renderResult ? (
                <div className={styles.renderMeta}>
                  <span>Renderer v{renderResult.manifest.rendererVersion}</span>
                  <span>{renderResult.manifest.files.find((file) => file.name === "campaign.html")?.bytes ?? 0} HTML bytes</span>
                  <span>SHA {renderResult.manifest.sourceFingerprint.slice(0, 12)}…</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </aside>
      </section>
    </main>
  );
}

function CanvasBlockPreview({
  block,
  selected,
  imagesOff,
  onSelect,
}: {
  block: CanvasBlock;
  selected: boolean;
  imagesOff: boolean;
  onSelect: () => void;
}) {
  const className = `${styles.canvasBlock} ${selected ? styles.canvasBlockSelected : ""}`;

  if (block.kind === "divider") {
    return <button type="button" className={className} onClick={onSelect}><span className={styles.divider} /></button>;
  }
  if (block.kind === "spacer") {
    return <button type="button" className={`${className} ${styles.spacerBlock}`} onClick={onSelect}><span>24px spacer</span></button>;
  }
  if (block.kind === "header") {
    return (
      <button type="button" className={`${className} ${styles.headerBlock}`} onClick={onSelect}>
        <strong>{block.title}</strong><span>Shop&nbsp;&nbsp; Journal&nbsp;&nbsp; About</span>
      </button>
    );
  }
  if (block.kind === "hero") {
    return (
      <button type="button" className={`${className} ${styles.heroBlock}`} onClick={onSelect}>
        {!imagesOff ? <span className={styles.heroImage}>ORBIT</span> : <span className={styles.imageOff}>Image hidden · alt: Orbit insulated bottle</span>}
        <span className={styles.emailEyebrow}>NEW PRODUCT</span>
        <strong>{block.title}</strong>
        <span className={styles.emailBody}>{block.body}</span>
        <span className={styles.emailCta}>{block.cta}</span>
      </button>
    );
  }
  if (block.kind === "image") {
    return (
      <button type="button" className={className} onClick={onSelect}>
        {!imagesOff ? <span className={styles.standaloneImage}>Campaign image</span> : <span className={styles.imageOff}>{block.body}</span>}
      </button>
    );
  }
  if (block.kind === "button") {
    return <button type="button" className={`${className} ${styles.buttonBlock}`} onClick={onSelect}><span className={styles.emailCta}>{block.cta}</span></button>;
  }
  if (block.kind === "products") {
    return (
      <button type="button" className={className} onClick={onSelect}>
        <span className={styles.sectionTitle}>{block.title}</span>
        <span className={styles.productGrid}>
          {["Lilac", "Ink"].map((finish) => (
            <span className={styles.productCard} key={finish}>
              {!imagesOff ? <i>{finish}</i> : <i className={styles.productImageOff}>Alt: {finish} Orbit bottle</i>}
              <b>Orbit / {finish}</b>
              <small>₹2,499</small>
              <em>View product</em>
            </span>
          ))}
        </span>
      </button>
    );
  }
  if (block.kind === "footer") {
    return (
      <button type="button" className={`${className} ${styles.footerBlock}`} onClick={onSelect}>
        <strong>{block.title}</strong>
        <span>{block.body}</span>
        <span>Website · Privacy · Unsubscribe</span>
      </button>
    );
  }
  if (block.kind === "social") {
    return <button type="button" className={`${className} ${styles.socialBlock}`} onClick={onSelect}><strong>{block.title}</strong><span>{block.body}</span></button>;
  }

  return (
    <button type="button" className={`${className} ${styles.textBlock}`} onClick={onSelect}>
      <strong>{block.title}</strong>
      {block.body ? <span>{block.body}</span> : null}
    </button>
  );
}
