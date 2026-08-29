"use server";
import { trackServerEvent } from "@/lib/analytics/server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabasePublicConfig } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

function readCredentials(formData: FormData, returnPath: "/auth/sign-in" | "/auth/sign-up") {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !email.includes("@")) {
    redirect(`${returnPath}?error=invalid-email`);
  }

  if (password.length < 8) {
    redirect(`${returnPath}?error=invalid-password`);
  }

  return { email, password };
}

export async function signIn(formData: FormData) {
  if (!getSupabasePublicConfig()) {
    redirect("/auth/sign-in?error=supabase-not-configured");
  }

  const credentials = readCredentials(formData, "/auth/sign-in");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(credentials);

  if (error) {
    redirect("/auth/sign-in?error=invalid-credentials");
  }

  revalidatePath("/", "layout");
  redirect("/onboarding");
}

export async function signUp(formData: FormData) {
  if (!getSupabasePublicConfig()) {
    redirect("/auth/sign-up?error=supabase-not-configured");
  }

  const credentials = readCredentials(formData, "/auth/sign-up");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp(credentials);

  if (error) {
    redirect("/auth/sign-up?error=signup-failed");
  }

  revalidatePath("/", "layout");

  if (data.session) {
    await trackServerEvent("signup");
    redirect("/onboarding");
  }

  redirect("/auth/sign-in?notice=check-email");
}

export async function signOut() {
  if (getSupabasePublicConfig()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  revalidatePath("/", "layout");
  redirect("/");
}
