import Link from "next/link";
import { signupWithPassword } from "../actions";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type SignupPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { error } = await searchParams;
  return (
    <>
      <p className="auth-eyebrow">REQUEST EARLY ACCESS</p>
      <h1>Create your workspace.</h1>
      <p className="auth-intro">Start with a secure account. You’ll add your company and channels next.</p>
      {!isSupabaseConfigured() && (
        <p className="auth-message error">Supabase environment variables are required before sign up can be used.</p>
      )}
      {error && <p className="auth-message error">{error}</p>}
      <form action={signupWithPassword} className="auth-form">
        <label htmlFor="signup-name">Full name</label>
        <input id="signup-name" name="full_name" autoComplete="name" required minLength={2} />
        <label htmlFor="signup-email">Work email</label>
        <input id="signup-email" name="email" type="email" autoComplete="email" required />
        <label htmlFor="signup-password">Password</label>
        <input id="signup-password" name="password" type="password" autoComplete="new-password" required minLength={8} />
        <small>Use at least 8 characters.</small>
        <SubmitButton>Create account</SubmitButton>
      </form>
      <p className="auth-switch">Already have an account? <Link href="/login">Sign in</Link></p>
    </>
  );
}
