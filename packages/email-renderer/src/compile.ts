import mjml2html from "mjml";

export const MJML_COMPILER_VERSION = "5.4.0";

export interface MjmlCompileIssue {
  line?: number;
  message: string;
  tagName?: string;
  formattedMessage?: string;
}

export interface CompiledEmailHtml {
  html: string;
  issues: MjmlCompileIssue[];
  compiler: {
    name: "mjml";
    version: typeof MJML_COMPILER_VERSION;
    validationLevel: "strict";
  };
}

function normalizeIssue(value: unknown): MjmlCompileIssue {
  if (!value || typeof value !== "object") return { message: String(value) };
  const issue = value as Record<string, unknown>;
  return {
    ...(typeof issue.line === "number" ? { line: issue.line } : {}),
    message: typeof issue.message === "string" ? issue.message : "Unknown MJML validation error",
    ...(typeof issue.tagName === "string" ? { tagName: issue.tagName } : {}),
    ...(typeof issue.formattedMessage === "string" ? { formattedMessage: issue.formattedMessage } : {})
  };
}

function extractIssues(error: unknown): MjmlCompileIssue[] {
  if (!error || typeof error !== "object") return [];
  const candidate = error as { errors?: unknown };
  return Array.isArray(candidate.errors) ? candidate.errors.map(normalizeIssue) : [];
}

export async function compileMjmlStrict(mjml: string): Promise<CompiledEmailHtml> {
  try {
    const result = await mjml2html(mjml, {
      validationLevel: "strict",
      beautify: false,
      minify: false,
      keepComments: false,
      ignoreIncludes: true,
      useMjmlConfigOptions: false
    });

    const issues = Array.isArray(result.errors) ? result.errors.map(normalizeIssue) : [];
    if (issues.length > 0) {
      throw new Error(`MJML compilation returned validation issues: ${issues.map((issue) => issue.formattedMessage ?? issue.message).join(" | ")}`);
    }
    if (!result.html.trim()) throw new Error("MJML compilation returned empty HTML.");

    return {
      html: result.html,
      issues,
      compiler: {
        name: "mjml",
        version: MJML_COMPILER_VERSION,
        validationLevel: "strict"
      }
    };
  } catch (error) {
    const issues = extractIssues(error);
    const detail = issues.length > 0
      ? issues.map((issue) => issue.formattedMessage ?? issue.message).join(" | ")
      : error instanceof Error ? error.message : String(error);
    throw new Error(`MJML compilation failed: ${detail}`);
  }
}
