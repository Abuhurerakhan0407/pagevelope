import { campaignToMjml } from "../../email-components/src/to-mjml.js";
import { runPreflight, type QaReport } from "../../email-qa/src/preflight.js";
import { validateCampaignDocument } from "../../editor-schema/src/validate.js";
import type { CampaignDocumentV1 } from "../../editor-schema/src/model.js";
import { campaignToPlainText } from "./plain-text.js";
import { fnv1a32, stableStringify } from "./stable.js";

export const RENDERER_VERSION = "0.1.0-spike";

export interface RendererSpikeResult {
  source: CampaignDocumentV1;
  mjml: string;
  plainText: string;
  qa: QaReport;
  manifest: {
    schemaVersion: "1.0.0";
    rendererVersion: string;
    sourceFingerprint: string;
    mjmlFingerprint: string;
  };
}

export function renderCampaignSpike(input: unknown): RendererSpikeResult {
  const validation = validateCampaignDocument(input);
  if (!validation.success || !validation.data) {
    const summary = validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ");
    throw new Error(`Invalid campaign document: ${summary}`);
  }
  const source = validation.data;
  const mjml = campaignToMjml(source);
  const plainText = campaignToPlainText(source);
  const qa = runPreflight(source);
  const canonicalSource = stableStringify(source);
  return {
    source,
    mjml,
    plainText,
    qa,
    manifest: {
      schemaVersion: source.schemaVersion,
      rendererVersion: RENDERER_VERSION,
      sourceFingerprint: fnv1a32(canonicalSource),
      mjmlFingerprint: fnv1a32(mjml)
    }
  };
}
