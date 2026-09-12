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
