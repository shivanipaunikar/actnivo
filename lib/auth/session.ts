import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { OrganizationRole } from "@/lib/supabase/database.types";

export type AuthenticatedUser = {
  id: string;
  email: string;
  fullName: string;
};

export type AppContext = {
  user: AuthenticatedUser;
  organization: {
    id: string;
    name: string;
    slug: string;
    country: string;
    currency: string;
    onboardingCompletedAt: string | null;
  };
  role: OrganizationRole;
};

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name,email")
    .eq("id", userId)
    .maybeSingle();
  const email = profile?.email ?? String(data.claims.email ?? "");

  return {
    id: userId,
    email,
    fullName: profile?.full_name?.trim() || email.split("@")[0] || "there",
  };
}

export async function requireAuthenticatedUser(returnTo: string) {
  const user = await getAuthenticatedUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return user;
}

export async function getAppContext(
  user: AuthenticatedUser,
): Promise<AppContext | null> {
  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id,role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) return null;

  const { data: organization } = await supabase
    .from("organizations")
    .select("id,name,slug,country,currency,onboarding_completed_at")
    .eq("id", membership.organization_id)
    .maybeSingle();

  if (!organization) return null;
  return {
    user,
    role: membership.role,
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      country: organization.country,
      currency: organization.currency,
      onboardingCompletedAt: organization.onboarding_completed_at,
    },
  };
}

export async function requireAppContext(): Promise<AppContext> {
  const user = await requireAuthenticatedUser("/app/dashboard");
  const context = await getAppContext(user);
  if (!context) redirect("/onboarding/company");
  if (!context.organization.onboardingCompletedAt) redirect("/onboarding/channels");
  return context;
}
