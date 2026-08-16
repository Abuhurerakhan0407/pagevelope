"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabasePublicConfig } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function createWorkspace(formData: FormData) {
  if (!getSupabasePublicConfig()) {
    redirect("/dashboard?error=supabase-not-configured");
  }

  const name = String(formData.get("name") ?? "").trim();
  const slug = normalizeSlug(String(formData.get("slug") ?? name));

  if (!name || name.length > 120 || !slug) {
    redirect("/dashboard?error=invalid-workspace");
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    redirect("/auth/sign-in");
  }

  const { error } = await supabase.rpc("create_workspace", {
    workspace_name: name,
    workspace_slug: slug,
  });

  if (error) {
    redirect("/dashboard?error=workspace-create-failed");
  }

  revalidatePath("/dashboard");
  redirect("/dashboard?created=1");
}
