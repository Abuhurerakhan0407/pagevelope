import Link from "next/link";
import { signIn } from "../actions";
import { getSupabasePublicConfig } from "@/lib/supabase/env";
import styles from "../auth.module.css";

type SignInPageProps = {
  searchParams: Promise<{ error?: string; notice?: string }>;
};

const errorMessages: Record<string, string> = {
  "invalid-email": "Enter a valid email address.",
  "invalid-password": "Password must be at least 8 characters.",
  "invalid-credentials": "Email or password is incorrect.",
  "supabase-not-configured": "Authentication is ready in code, but this environment is not connected to a Supabase project yet.",
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const configured = Boolean(getSupabasePublicConfig());
  const errorMessage = params.error ? errorMessages[params.error] : null;
  const noticeMessage = params.notice === "check-email"
    ? "Account created. Check your email to confirm your address, then sign in."
    : null;

  return (
    <main className={styles.shell}>
      <section className={styles.card}>
        <Link className={styles.brand} href="/">
          <span className={styles.mark}>P</span>
          Pagevelope
        </Link>
        <p className={styles.eyebrow}>Workspace access</p>
        <h1 className={styles.title}>Welcome back.</h1>
        <p className={styles.copy}>Sign in to continue to your brands, campaigns, approvals and publishing workspace.</p>

        {errorMessage ? <p className={`${styles.message} ${styles.error}`}>{errorMessage}</p> : null}
        {noticeMessage ? <p className={styles.message}>{noticeMessage}</p> : null}
        {!configured && !errorMessage ? (
          <p className={styles.message}>Preview mode: Supabase project credentials have not been added to this environment, so sign-in is intentionally disabled.</p>
        ) : null}

        <form className={styles.form} action={signIn}>
          <label className={styles.label}>
            Email
            <input className={styles.input} type="email" name="email" autoComplete="email" required />
          </label>
          <label className={styles.label}>
            Password
            <input className={styles.input} type="password" name="password" autoComplete="current-password" minLength={8} required />
          </label>
          <button className={styles.button} type="submit" disabled={!configured}>Sign in</button>
        </form>

        <p className={styles.footer}>New to Pagevelope? <Link href="/auth/sign-up">Create your workspace account</Link></p>
      </section>
    </main>
  );
}
