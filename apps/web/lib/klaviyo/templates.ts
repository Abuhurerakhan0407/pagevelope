import { KLAVIYO_API_BASE, KLAVIYO_API_REVISION } from "./config";
import { createCodeTemplate, KlaviyoApiError } from "./client";

function headers(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.api+json",
    "Content-Type": "application/vnd.api+json",
    revision: KLAVIYO_API_REVISION,
  };
}

function filterString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export async function findCodeTemplateByName(accessToken: string, name: string): Promise<string | null> {
  const url = new URL(`${KLAVIYO_API_BASE}/api/templates`);
  url.searchParams.set("filter", `equals(name,"${filterString(name)}")`);
  url.searchParams.set("page[size]", "10");

  const response = await fetch(url, { headers: headers(accessToken), cache: "no-store" });
  const body = await response.json().catch(() => null) as
    | { data?: Array<{ type?: string; id?: string; attributes?: { name?: string; editor_type?: string } }>; errors?: unknown }
    | null;
  if (!response.ok) throw new KlaviyoApiError("Klaviyo template lookup failed.", response.status, body);
  const match = body?.data?.find((item) => item.type === "template" && item.attributes?.name === name && item.attributes?.editor_type === "CODE");
  return match?.id ?? null;
}

export async function updateCodeTemplate(
  accessToken: string,
  input: { templateId: string; name: string; html: string; text: string },
): Promise<void> {
  const response = await fetch(`${KLAVIYO_API_BASE}/api/templates/${encodeURIComponent(input.templateId)}`, {
    method: "PATCH",
    headers: headers(accessToken),
    body: JSON.stringify({
      data: {
        type: "template",
        id: input.templateId,
        attributes: {
          name: input.name,
          editor_type: "CODE",
          html: input.html,
          text: input.text,
        },
      },
    }),
    cache: "no-store",
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new KlaviyoApiError("Klaviyo template update failed.", response.status, body);
}

export async function upsertCodeTemplate(
  accessToken: string,
  input: { name: string; html: string; text: string },
): Promise<{ templateId: string; operation: "created" | "updated" }> {
  const existing = await findCodeTemplateByName(accessToken, input.name);
  if (!existing) {
    const created = await createCodeTemplate(accessToken, input);
    return { templateId: created.templateId, operation: "created" };
  }
  await updateCodeTemplate(accessToken, { templateId: existing, ...input });
  return { templateId: existing, operation: "updated" };
}
