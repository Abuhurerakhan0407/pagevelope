const phases = [
  "Foundation",
  "Email engine",
  "Professional editor",
  "Motion studio",
  "Inbox Lab",
  "Approval",
  "Klaviyo publish",
];

export default function Home() {
  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Pagevelope home">
          <span className="brandMark">P</span>
          <span>Pagevelope</span>
        </a>
        <span className="phaseBadge">Build · Visual Builder v1</span>
      </header>

      <section className="hero" id="top">
        <p className="eyebrow">Shopify → Pagevelope → Klaviyo</p>
        <h1>Campaign production, without inbox roulette.</h1>
        <p className="heroCopy">
          Build studio-grade email campaigns with safe motion, real testing, client approval,
          and traceable publishing.
        </p>
        <div className="actions">
          <a className="primaryButton" href="/builder">Open visual builder</a>
          <a className="secondaryButton" href="#roadmap">View build roadmap</a>
        </div>
      </section>

      <section className="statusGrid" aria-label="Product build status">
        <article className="statusCard">
          <span>Current work</span>
          <strong>Professional visual builder</strong>
          <p>Block library, layers, constrained canvas, properties, previews, and QA-aware publishing controls.</p>
        </article>
        <article className="statusCard">
          <span>Production proof</span>
          <strong>Renderer hardening</strong>
          <p>Controlled MJML, strict compile, deterministic release bundles, and a twenty-campaign safety matrix.</p>
        </article>
        <article className="statusCard">
          <span>Release boundary</span>
          <strong>Inbox Lab required</strong>
          <p>No publishing while critical compatibility failures remain.</p>
        </article>
      </section>

      <section className="roadmap" id="roadmap">
        <div>
          <p className="eyebrow">Gated execution</p>
          <h2>One phase. One gate.</h2>
        </div>
        <ol>
          {phases.map((phase, index) => (
            <li className={index === 2 ? "activePhase" : undefined} key={phase}>
              <span>{String(index).padStart(2, "0")}</span>
              <strong>{phase}</strong>
            </li>
          ))}
        </ol>
      </section>

      <section className="rules" id="rules">
        <p className="eyebrow">Non-negotiable</p>
        <h2>AI proposes. Deterministic systems publish.</h2>
        <p>
          Pagevelope stores campaigns as validated structured data. Controlled components
          create production email HTML. Every approved release keeps QA evidence, asset
          hashes, renderer version, destination, and operator.
        </p>
      </section>
    </main>
  );
}
