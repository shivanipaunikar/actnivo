import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CommerceChannel,
  Database,
  OrganizationRole,
} from "@/lib/supabase/database.types";

export const supportedChannels: Array<{
  value: CommerceChannel;
  label: string;
}> = [
  { value: "shopify", label: "Shopify" },
  { value: "amazon", label: "Amazon" },
  { value: "flipkart", label: "Flipkart" },
  { value: "meesho", label: "Meesho" },
  { value: "blinkit", label: "Blinkit" },
  { value: "zepto", label: "Zepto" },
  { value: "swiggy_instamart", label: "Swiggy Instamart" },
  { value: "woocommerce", label: "WooCommerce" },
  { value: "unicommerce", label: "Unicommerce" },
  { value: "easyecom", label: "EasyEcom" },
  { value: "other", label: "Other" },
];

export type CompanyOnboardingInput = {
  name: string;
  website: string | null;
  country: string;
  monthlyOrderVolume: number;
  skuCount: number;
};

const timezones: Record<string, string> = {
  India: "Asia/Kolkata",
  Singapore: "Asia/Singapore",
  "United Kingdom": "Europe/London",
  "United States": "America/New_York",
};

export function slugifyOrganization(name: string) {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "organization"
  );
}

export function buildOrganizationRecords(
  input: CompanyOnboardingInput,
  userId: string,
  organizationId: string,
) {
  return {
    organization: {
      id: organizationId,
      created_by: userId,
      name: input.name.trim(),
      slug: `${slugifyOrganization(input.name)}-${organizationId.slice(0, 8)}`,
      website: input.website,
      country: input.country,
      timezone: timezones[input.country] ?? "Asia/Kolkata",
      currency: input.country === "India" ? "INR" : "USD",
      monthly_order_volume: input.monthlyOrderVolume,
      sku_count: input.skuCount,
    },
    membership: {
      organization_id: organizationId,
      user_id: userId,
      role: "owner" as OrganizationRole,
    },
  };
}

export function normalizeChannels(values: string[], customName?: string) {
  const supported = new Set(supportedChannels.map(({ value }) => value));
  const unique = [...new Set(values)].filter((value): value is CommerceChannel =>
    supported.has(value as CommerceChannel),
  );

  return unique
    .filter((channel) => channel !== "other" || Boolean(customName?.trim()))
    .map((channel) => ({
      channel,
      custom_name: channel === "other" ? customName!.trim() : null,
    }));
}

export async function createOrganizationForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: CompanyOnboardingInput,
) {
  const organizationId = crypto.randomUUID();
  const records = buildOrganizationRecords(input, userId, organizationId);

  const { error: organizationError } = await supabase
    .from("organizations")
    .insert(records.organization);
  if (organizationError) throw new Error(organizationError.message);

  const { error: membershipError } = await supabase
    .from("organization_members")
    .insert(records.membership);
  if (membershipError) throw new Error(membershipError.message);

  return organizationId;
}

export async function completeChannelOnboarding(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  channels: ReturnType<typeof normalizeChannels>,
) {
  const { error: deleteError } = await supabase
    .from("organization_channels")
    .delete()
    .eq("organization_id", organizationId);
  if (deleteError) throw new Error(deleteError.message);

  if (channels.length > 0) {
    const { error: insertError } = await supabase
      .from("organization_channels")
      .insert(
        channels.map((channel) => ({
          organization_id: organizationId,
          ...channel,
        })),
      );
    if (insertError) throw new Error(insertError.message);
  }

  const { error: organizationError } = await supabase
    .from("organizations")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", organizationId);
  if (organizationError) throw new Error(organizationError.message);
}
