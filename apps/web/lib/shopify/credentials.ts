import { decryptIntegrationSecret } from "@/lib/integrations/crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireShopifyServerConfig } from "./config";

export async function getWorkspaceShopifyAccess(workspaceId: string): Promise<{
  connectionId: string;
  shop: string;
  accessToken: string;
}> {
  const config = requireShopifyServerConfig();
  const admin = createAdminClient(config.supabaseServiceRoleKey);

  const { data: connection, error: connectionError } = await admin
    .from("integration_connections")
    .select("id,status,external_account_id")
    .eq("workspace_id", workspaceId)
    .eq("provider", "shopify")
    .maybeSingle();

  if (connectionError || !connection || connection.status !== "connected") {
    throw new Error("A connected Shopify store is required.");
  }

  const { data: credentials, error: credentialsError } = await admin
    .from("integration_credentials_secure")
    .select("access_token_ciphertext")
    .eq("connection_id", connection.id)
    .maybeSingle();

  if (credentialsError || !credentials?.access_token_ciphertext) {
    throw new Error("Shopify credentials are unavailable. Reconnect the store.");
  }

  return {
    connectionId: connection.id,
    shop: connection.external_account_id,
    accessToken: decryptIntegrationSecret(credentials.access_token_ciphertext, config.tokenEncryptionKey),
  };
}
