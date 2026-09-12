"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { messagePath, safeNextPath } from "@/lib/auth/redirects";

async function requestOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

export async function loginWithPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));
  if (!email || !password) redirect(messagePath("/login", "error", "Enter your email and password."));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(messagePath("/login", "error", error.message));
  redirect(next);
}

export async function signupWithPassword(formData: FormData) {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (fullName.length < 2 || !email || password.length < 8) {
    redirect(messagePath("/signup", "error", "Use your name, work email, and at least 8 password characters."));
  }

  const supabase = await createClient();
  const emailRedirectTo = `${await requestOrigin()}/auth/callback?next=/onboarding/company`;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo, data: { full_name: fullName } },
  });
  if (error) redirect(messagePath("/signup", "error", error.message));
  if (data.session) redirect("/onboarding/company");
  redirect(messagePath("/login", "success", "Check your email to confirm your account."));
}

export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) redirect(messagePath("/login", "error", "Enter your email first."));

  const supabase = await createClient();
  const emailRedirectTo = `${await requestOrigin()}/auth/callback?next=/app/dashboard`;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo, shouldCreateUser: false },
  });
  if (error) redirect(messagePath("/login", "error", error.message));
  redirect(messagePath("/login", "success", "Magic link sent. Check your inbox."));
}
