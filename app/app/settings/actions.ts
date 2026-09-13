"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppContext } from "@/lib/auth/session";
import { assertCanManageInventory } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

function integer(formData: FormData, field: string, min: number, max: number) {
  const value = Number(formData.get(field));
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${field.replaceAll("_", " ")} must be between ${min} and ${max}.`);
  return value;
}

export async function saveOperatingSettings(formData: FormData) {
  const context = await requireAppContext();
  let target = "/app/settings?saved=1";
  try {
    assertCanManageInventory(context.role);
    const supabase = await createClient();
    const record = {
      organization_id: context.organization.id,
      replenishment_lead_time_days: integer(formData, "replenishment_lead_time_days", 0, 365),
      safety_days: integer(formData, "safety_days", 0, 365),
      minimum_safety_stock: integer(formData, "minimum_safety_stock", 0, 1_000_000),
      target_days_of_cover: integer(formData, "target_days_of_cover", 1, 365),
      updated_by: context.user.id,
    };
    const result = await supabase.from("organization_operating_settings").upsert(record, { onConflict: "organization_id" });
    if (result.error) throw new Error(result.error.message);
    revalidatePath("/app/settings");
  } catch (error) {
    target = `/app/settings?error=${encodeURIComponent(error instanceof Error ? error.message : "Could not save settings.")}`;
  }
  redirect(target);
}

export async function saveWorkspaceSettings(formData: FormData) {
  const context = await requireAppContext();
  if (!["owner","admin"].includes(context.role)) throw new Error("Only owners and admins can update workspace settings.");
  const monthlySoftwareCost = Number(String(formData.get("monthly_software_cost") ?? "0"));
  const defaultRiskThreshold = Number(String(formData.get("default_risk_threshold") ?? "25000"));
  const confidencePct = Number(String(formData.get("default_confidence_threshold") ?? "85"));
  if (!Number.isFinite(monthlySoftwareCost) || monthlySoftwareCost < 0) throw new Error("Software cost must be 0 or more.");
  if (!Number.isFinite(defaultRiskThreshold) || defaultRiskThreshold < 0) throw new Error("Risk threshold must be 0 or more.");
  if (!Number.isFinite(confidencePct) || confidencePct < 0 || confidencePct > 100) throw new Error("Confidence must be between 0 and 100.");
  const supabase = await createClient();
  const result = await (supabase as any).from("organization_settings").upsert({
    organization_id: context.organization.id,
    monthly_software_cost: monthlySoftwareCost,
    default_risk_threshold: defaultRiskThreshold,
    default_confidence_threshold: confidencePct / 100,
    notify_critical_issues: formData.get("notify_critical_issues") === "on",
    notify_action_approvals: formData.get("notify_action_approvals") === "on",
    notify_verification_failures: formData.get("notify_verification_failures") === "on",
  }, { onConflict: "organization_id" });
  if (result.error) throw new Error(result.error.message);
  revalidatePath("/app/settings");
  revalidatePath("/app/value");
}

export async function saveOrganizationProfile(formData: FormData) {
  const context = await requireAppContext();
  if (!["owner","admin"].includes(context.role)) throw new Error("Only owners and admins can update the workspace profile.");
  const name = String(formData.get("name") ?? "").trim();
  const website = String(formData.get("website") ?? "").trim() || null;
  const timezone = String(formData.get("timezone") ?? "").trim();
  if (name.length < 2) throw new Error("Workspace name is too short.");
  if (!timezone) throw new Error("Timezone is required.");
  const supabase = await createClient();
  const result = await (supabase as any).from("organizations").update({ name, website, timezone }).eq("id", context.organization.id);
  if (result.error) throw new Error(result.error.message);
  revalidatePath("/app/settings");
  revalidatePath("/app/dashboard");
}
