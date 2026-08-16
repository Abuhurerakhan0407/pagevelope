import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { campaignToMjml } from "../../email-components/src/to-mjml.js";
import { runPreflight, type QaReport } from "../../email-qa/src/preflight.js";
import { validateCampaignDocument } from "../../editor-schema/src/validate.js";
import type { CampaignDocumentV1 } from "../../editor-schema/src/model.js";
import { compileMjmlStrict, MJML_COMPILER_VERSION } from "./compile.js";
import { collectMotionEvidence, type MotionEvidenceSummary } from "./motion-evidence.js";
import { assertSafeCompiledOutput } from "./output-safety.js";
import { campaignToPlainText } from "./plain-text.js";
import { stableStringify } from "./stable.js";

export const RELEASE_RENDERER_VERSION = "0.2.0";
export const RELEASE_MANIFEST_VERSION = "1.0.0";

export interface ReleaseFileDescriptor {
  name: "source.json" | "campaign.mjml" | "campaign.html" | "campaign.txt";
  mediaType: string;
  bytes: number;
  sha256: string;
}

export interface CampaignReleaseManifest {
  manifestVersion: typeof RELEASE_MANIFEST_VERSION;
  campaignId: string;
  campaignName: string;
  schemaVersion: "1.0.0";
  rendererVersion: typeof RELEASE_RENDERER_VERSION;
  compiler: {
    name: "mjml";
    version: typeof MJML_COMPILER_VERSION;
    validationLevel: "strict";
  };
  qa: QaReport;
  motion: MotionEvidenceSummary;
  sourceFingerprint: string;
  files: ReleaseFileDescriptor[];
}

export interface CampaignReleaseBundle {
  source: CampaignDocumentV1;
  mjml: string;
  html: string;
  plainText: string;
  manifest: CampaignReleaseManifest;
  files: {
    "source.json": string;
    "campaign.mjml": string;
    "campaign.html": string;
    "campaign.txt": string;
    "manifest.json": string;
  };
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function descriptor(name: ReleaseFileDescriptor["name"], mediaType: string, value: string): ReleaseFileDescriptor {
  return {
    name,
    mediaType,
    bytes: Buffer.byteLength(value, "utf8"),
    sha256: sha256(value)
  };
}

function validateSource(input: unknown): CampaignDocumentV1 {
  const validation = validateCampaignDocument(input);
  if (!validation.success || !validation.data) {
    const summary = validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ");
    throw new Error(`Invalid campaign document: ${summary}`);
  }
  return validation.data;
}

export async function renderCampaignRelease(input: unknown): Promise<CampaignReleaseBundle> {
  const source = validateSource(input);
  const qa = runPreflight(source);
  if (qa.status === "BLOCK") {
    const detail = qa.issues.filter((issue) => issue.severity === "BLOCK").map((issue) => `${issue.code}: ${issue.message}`).join("; ");
    throw new Error(`Release blocked by QA: ${detail}`);
  }

  const sourceJson = stableStringify(source);
  const mjml = campaignToMjml(source);
  const plainText = campaignToPlainText(source);
  const compiled = await compileMjmlStrict(mjml);
  const html = compiled.html;
  const motion = collectMotionEvidence(source);

  assertSafeCompiledOutput(source, html, plainText);

  const files: ReleaseFileDescriptor[] = [
    descriptor("source.json", "application/json", sourceJson),
    descriptor("campaign.mjml", "application/vnd.mjml+xml", mjml),
    descriptor("campaign.html", "text/html; charset=utf-8", html),
    descriptor("campaign.txt", "text/plain; charset=utf-8", plainText)
  ];

  const manifest: CampaignReleaseManifest = {
    manifestVersion: RELEASE_MANIFEST_VERSION,
    campaignId: source.id,
    campaignName: source.name,
    schemaVersion: source.schemaVersion,
    rendererVersion: RELEASE_RENDERER_VERSION,
    compiler: compiled.compiler,
    qa,
    motion,
    sourceFingerprint: sha256(sourceJson),
    files
  };

  return {
    source,
    mjml,
    html,
    plainText,
    manifest,
    files: {
      "source.json": sourceJson,
      "campaign.mjml": mjml,
      "campaign.html": html,
      "campaign.txt": plainText,
      "manifest.json": stableStringify(manifest)
    }
  };
}
