"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAppContext, requireAuthenticatedUser } from "@/lib/auth/session";
import { messagePath } from "@/lib/auth/redirects";
import {
  completeChannelOnboarding,
  createOrganizationForUser,
  normalizeChannels,
} from "@/lib/data/organizations";

function nonNegativeInteger(value: FormDataEntryValue | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export async function createCompany(formData: FormData) {
  const user = await requireAuthenticatedUser("/onboarding/company");
  const existing = await getAppContext(user);
  if (existing) redirect(existing.organization.onboardingCompletedAt ? "/app/dashboard" : "/onboarding/channels");

  const name = String(formData.get("name") ?? "").trim();
  const websiteValue = String(formData.get("website") ?? "").trim();
  const country = String(formData.get("country") ?? "India");
  const monthlyOrderVolume = nonNegativeInteger(formData.get("monthly_order_volume"));
  const skuCount = nonNegativeInteger(formData.get("sku_count"));
  if (name.length < 2 || monthlyOrderVolume === null || skuCount === null) {
    redirect(messagePath("/onboarding/company", "error", "Complete all required company details."));
  }

  let website: string | null = null;
  if (websiteValue) {
    try {
      website = new URL(websiteValue.startsWith("http") ? websiteValue : `https://${websiteValue}`).toString();
    } catch {
      redirect(messagePath("/onboarding/company", "error", "Enter a valid website address."));
    }
  }

  const supabase = await createClient();
  try {
    await createOrganizationForUser(supabase, user.id, {
      name,
      website,
      country,
      monthlyOrderVolume,
      skuCount,
    });
  } catch {
    redirect(messagePath("/onboarding/company", "error", "We could not create your workspace. Try again."));
  }
  redirect("/onboarding/channels");
}

export async function saveChannels(formData: FormData) {
  const user = await requireAuthenticatedUser("/onboarding/channels");
  const context = await getAppContext(user);
  if (!context) redirect("/onboarding/company");

  const channels = normalizeChannels(
    formData.getAll("channels").map(String),
    String(formData.get("other_channel") ?? ""),
  );
  if (channels.length === 0) {
    redirect(messagePath("/onboarding/channels", "error", "Select at least one channel."));
  }

  const supabase = await createClient();
  try {
    await completeChannelOnboarding(supabase, context.organization.id, channels);
  } catch {
    redirect(messagePath("/onboarding/channels", "error", "We could not save your channels. Try again."));
  }
  redirect("/app/dashboard");
}
