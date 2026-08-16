import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient(serviceRoleKey: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is required for server admin operations.");
  if (!serviceRoleKey) throw new Error("Supabase service-role key is required for server admin operations.");

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
