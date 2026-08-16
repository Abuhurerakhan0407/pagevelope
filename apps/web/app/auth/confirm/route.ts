import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabasePublicConfig } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const redirectTo = request.nextUrl.clone();
  redirectTo.searchParams.delete("token_hash");
  redirectTo.searchParams.delete("type");

  if (!getSupabasePublicConfig()) {
    redirectTo.pathname = "/auth/sign-in";
    redirectTo.searchParams.set("error", "supabase-not-configured");
    return NextResponse.redirect(redirectTo);
  }

  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

    if (!error) {
      redirectTo.pathname = "/dashboard";
      redirectTo.searchParams.delete("error");
      return NextResponse.redirect(redirectTo);
    }
  }

  redirectTo.pathname = "/auth/sign-in";
  redirectTo.searchParams.set("error", "confirmation-failed");
  return NextResponse.redirect(redirectTo);
}
