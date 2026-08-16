# Pagevelope Agent Rules

## Product promise

Turn a Shopify product drop into a studio-grade Klaviyo campaign with safe motion, approvals, inbox testing, and production-ready publishing.

## Non-negotiable boundaries

- Pagevelope does not send bulk marketing campaigns.
- Pagevelope does not become a CRM, contact database, cold-email tool, warm-up tool, AMP-email product, freeform Figma clone, template dump, or unrestricted AI HTML generator.
- Klaviyo remains first ESP.
- Editable campaign source remains versioned, schema-validated JSON.
- Production HTML comes only from controlled Pagevelope components and a deterministic renderer.
- Every motion asset requires an animated output, meaningful first frame, and browser preview.
- Playwright proves web behavior only. Inbox evidence requires preflight checks, real test delivery, and real-client testing.
- Approval attaches to one immutable version.
- Publishing fails closed when blocking QA remains.

## Ownership

- ChatGPT: product decisions, UX specifications, acceptance criteria.
- Codex: primary implementation and automated tests.
- Jules: scoped isolated engineering tasks and maintenance; never edit the same branch/file set as Codex.
- Stitch: product design, design-system exploration, and interactive screen prototypes.
- OpenCode: narrow fixes with explicit file ownership.
- Claude App: independent review packet; no direct branch edits.
- Antigravity: browser verification and evidence.
- Hermes: research, feedback synthesis, issue drafting, reporting.
- Software Factory: orchestration only after safety proof.

One writer owns one branch and file set. Reviewers report findings without rewriting owned files.

## Required task packet

Every engineering task must define:

- outcome;
- user story;
- evidence;
- scope and exclusions;
- owner and branch;
- data/security impact;
- acceptance criteria;
- required tests;
- visual or inbox evidence;
- rollback path;
- human approvals.

## Completion evidence

Every completion report must contain:

- summary;
- changed files;
- exact commands;
- passing/failing tests;
- preview URL when available;
- screenshots or recordings when visual;
- renderer/Inbox Lab evidence when email-related;
- known limitations;
- security concerns;
- rollback instructions.

## Human-only actions

- production secrets;
- production deployment;
- database migration application;
- billing changes;
- customer-template publishing;
- remote template overwrite;
- destructive actions.
