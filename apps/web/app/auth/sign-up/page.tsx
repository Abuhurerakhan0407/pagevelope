import Link from "next/link";
import { signUp } from "../actions";
import { getSupabasePublicConfig } from "@/lib/supabase/env";
import styles from "../auth.module.css";

type SignUpPageProps = {
  searchParams: Promise<{ error?: string }>;
};

const errorMessages: Record<string, string> = {
  "invalid-email": "Enter a valid email address.",
  "invalid-password": "Use a password with at least 8 characters.",
  "signup-failed": "We could not create that account. Try another email or try again shortly.",
  "supabase-not-configured": "Authentication is ready in code, but this environment is not connected to a Supabase project yet.",
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const params = await searchParams;
  const configured = Boolean(getSupabasePublicConfig());
  const errorMessage = params.error ? errorMessages[params.error] : null;

  return (
    <main className={styles.shell}>
      <section className={styles.card}>
        <Link className={styles.brand} href="/">
          <span className={styles.mark}>P</span>
          Pagevelope
        </Link>
        <p className={styles.eyebrow}>Start a workspace</p>
        <h1 className={styles.title}>Build campaigns that survive the inbox.</h1>
        <p className={styles.copy}>Create your account. Workspace and brand onboarding comes immediately after authentication.</p>

        {errorMessage ? <p className={`${styles.message} ${styles.error}`}>{errorMessage}</p> : null}
        {!configured && !errorMessage ? (
          <p className={styles.message}>Preview mode: account creation stays disabled until a Supabase project is connected to this environment.</p>
        ) : null}

        <form className={styles.form} action={signUp}>
          <label className={styles.label}>
            Work email
            <input className={styles.input} type="email" name="email" autoComplete="email" required />
          </label>
          <label className={styles.label}>
            Password
            <input className={styles.input} type="password" name="password" autoComplete="new-password" minLength={8} required />
          </label>
          <button className={styles.button} type="submit" disabled={!configured}>Create account</button>
        </form>

        <p className={styles.footer}>Already have an account? <Link href="/auth/sign-in">Sign in</Link></p>
      </section>
    </main>
  );
}
