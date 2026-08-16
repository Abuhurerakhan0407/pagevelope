import { KLAVIYO_API_BASE, KLAVIYO_API_REVISION } from "./config";

export class KlaviyoApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details: unknown,
  ) {
    super(message);
    this.name = "KlaviyoApiError";
  }
}

type JsonApiResource = {
  type: string;
  id: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<string, unknown>;
};

type JsonApiResponse = { data: JsonApiResource; [key: string]: unknown };

async function requestKlaviyo(
  accessToken: string,
  path: string,
  init: RequestInit,
): Promise<JsonApiResponse> {
  if (!accessToken) throw new Error("Klaviyo OAuth access token is required.");

  const response = await fetch(`${KLAVIYO_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      revision: KLAVIYO_API_REVISION,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body && typeof body === "object" && "errors" in body
      ? JSON.stringify((body as { errors: unknown }).errors)
      : `HTTP ${response.status}`;
    throw new KlaviyoApiError(`Klaviyo API request failed: ${detail}`, response.status, body);
  }

  return body as JsonApiResponse;
}

export async function createCodeTemplate(
  accessToken: string,
  input: { name: string; html: string; text: string },
): Promise<{ templateId: string }> {
  const response = await requestKlaviyo(accessToken, "/api/templates", {
    method: "POST",
    body: JSON.stringify({
      data: {
        type: "template",
        attributes: {
          name: input.name,
          editor_type: "CODE",
          html: input.html,
          text: input.text,
        },
      },
    }),
  });

  if (response.data.type !== "template" || !response.data.id) {
    throw new Error("Klaviyo template response did not contain a template id.");
  }
  return { templateId: response.data.id };
}

export async function assignTemplateToCampaignMessage(
  accessToken: string,
  input: { templateId: string; messageId: string },
): Promise<{ messageId: string; assignedTemplateId?: string }> {
  const response = await requestKlaviyo(accessToken, "/api/campaign-message-assign-template", {
    method: "POST",
    body: JSON.stringify({
      data: {
        type: "campaign-message",
        id: input.messageId,
        relationships: {
          template: {
            data: { type: "template", id: input.templateId },
          },
        },
      },
    }),
  });

  if (response.data.type !== "campaign-message" || !response.data.id) {
    throw new Error("Klaviyo campaign-message response did not contain a message id.");
  }

  const relationship = response.data.relationships?.template as
    | { data?: { id?: string } }
    | undefined;
  return { messageId: response.data.id, assignedTemplateId: relationship?.data?.id };
}

export async function getKlaviyoAccount(accessToken: string): Promise<{ accountId: string; name?: string }> {
  const response = await fetch(`${KLAVIYO_API_BASE}/api/accounts`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.api+json",
      revision: KLAVIYO_API_REVISION,
    },
    cache: "no-store",
  });
  const body = await response.json().catch(() => null) as
    | { data?: Array<{ id?: string; attributes?: { contact_information?: { organization_name?: string }; organization_name?: string } }>; errors?: unknown }
    | null;
  if (!response.ok) throw new KlaviyoApiError("Klaviyo account lookup failed.", response.status, body);
  const account = body?.data?.[0];
  if (!account?.id) throw new Error("Klaviyo account lookup returned no account id.");
  return {
    accountId: account.id,
    name: account.attributes?.organization_name ?? account.attributes?.contact_information?.organization_name,
  };
}
