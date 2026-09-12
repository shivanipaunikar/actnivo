import Link from "next/link";
import { loginWithPassword, sendMagicLink } from "../actions";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { safeNextPath } from "@/lib/auth/redirects";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; success?: string; next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = safeNextPath(params.next ?? null);
  return (
    <>
      <p className="auth-eyebrow">ACTNIVO WORKSPACE</p>
      <h1>Welcome back.</h1>
      <p className="auth-intro">Sign in to your commerce operations workspace.</p>

      {!isSupabaseConfigured() && (
        <p className="auth-message error">Supabase environment variables are required before sign in can be used.</p>
      )}
      {params.error && <p className="auth-message error">{params.error}</p>}
      {params.success && <p className="auth-message success">{params.success}</p>}

      <form action={loginWithPassword} className="auth-form">
        <input type="hidden" name="next" value={next} />
        <label htmlFor="login-email">Work email</label>
        <input id="login-email" name="email" type="email" autoComplete="email" required />
        <label htmlFor="login-password">Password</label>
        <input id="login-password" name="password" type="password" autoComplete="current-password" required />
        <SubmitButton>Sign in</SubmitButton>
      </form>

      <div className="auth-divider"><span>or</span></div>
      <form action={sendMagicLink} className="auth-form compact">
        <label htmlFor="magic-email">Email me a magic link</label>
        <div className="auth-inline">
          <input id="magic-email" name="email" type="email" autoComplete="email" placeholder="you@company.com" required />
          <button type="submit">Send link</button>
        </div>
      </form>
      <p className="auth-switch">New to Actnivo? <Link href="/signup">Create an account</Link></p>
    </>
  );
}
