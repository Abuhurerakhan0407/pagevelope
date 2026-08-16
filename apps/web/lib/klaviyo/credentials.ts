import { requireKlaviyoServerConfig } from "./config";
import { decryptKlaviyoToken, encryptKlaviyoToken } from "./crypto";
import { refreshKlaviyoToken } from "./oauth";
import { createAdminClient } from "@/lib/supabase/admin";

const REFRESH_SKEW_MS = 60_000;

export async function getWorkspaceKlaviyoAccess(workspaceId: string): Promise<{
  connectionId: string;
  accessToken: string;
  accountId: string;
  accountName: string | null;
}> {
  const config = requireKlaviyoServerConfig();
  const admin = createAdminClient(config.supabaseServiceRoleKey);

  const { data: connection, error: connectionError } = await admin
    .from("integration_connections")
    .select("id,status,external_account_id,external_account_name")
    .eq("workspace_id", workspaceId)
    .eq("provider", "klaviyo")
    .maybeSingle();

  if (connectionError || !connection || connection.status !== "connected") {
    throw new Error("A connected Klaviyo account is required.");
  }

  const { data: credentials, error: credentialsError } = await admin
    .from("integration_credentials_secure")
    .select("access_token_ciphertext,refresh_token_ciphertext,access_expires_at")
    .eq("connection_id", connection.id)
    .maybeSingle();

  if (credentialsError || !credentials) {
    throw new Error("Klaviyo credentials are unavailable. Reconnect the account.");
  }

  let accessToken = decryptKlaviyoToken(credentials.access_token_ciphertext, config.tokenEncryptionKey);
  const expiresAt = new Date(credentials.access_expires_at).getTime();

  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() + REFRESH_SKEW_MS) {
    const refreshToken = decryptKlaviyoToken(credentials.refresh_token_ciphertext, config.tokenEncryptionKey);
    try {
      const rotated = await refreshKlaviyoToken(config, refreshToken);
      accessToken = rotated.access_token;
      const { error: updateError } = await admin
        .from("integration_credentials_secure")
        .update({
          access_token_ciphertext: encryptKlaviyoToken(rotated.access_token, config.tokenEncryptionKey),
          refresh_token_ciphertext: encryptKlaviyoToken(rotated.refresh_token, config.tokenEncryptionKey),
          access_expires_at: new Date(Date.now() + rotated.expires_in * 1000).toISOString(),
          token_type: rotated.token_type.toLowerCase(),
          updated_at: new Date().toISOString(),
        })
        .eq("connection_id", connection.id);
      if (updateError) throw new Error("Refreshed Klaviyo credentials could not be stored.");
    } catch (error) {
      await admin
        .from("integration_connections")
        .update({ status: "reauthorization_required", updated_at: new Date().toISOString() })
        .eq("id", connection.id);
      throw error;
    }
  }

  return {
    connectionId: connection.id,
    accessToken,
    accountId: connection.external_account_id,
    accountName: connection.external_account_name,
  };
}
