"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppContext } from "@/lib/auth/session";
import { assertCanManageInventory } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { runAutopilot } from "@/lib/autopilot/engine";

function errorMessage(error: unknown) { return error instanceof Error ? error.message : "Something went wrong."; }

export async function updateAutopilotPolicy(formData: FormData) {
  const context = await requireAppContext();
  let target = "/app/autopilot";
  try {
    assertCanManageInventory(context.role);
    const supabase = await createClient();
    const db = supabase as any;
    const id = String(formData.get("policy_id") ?? "");
    const enabled = formData.get("enabled") === "on";
    const minimumRevenueAtRisk = Number(formData.get("minimum_revenue_at_risk") ?? 0);
    const minimumConfidencePct = Number(formData.get("minimum_confidence_pct") ?? 0);
    const dailyActionCap = Number(formData.get("daily_action_cap") ?? 10);
    if (!id) throw new Error("Policy is missing.");
    if (!Number.isFinite(minimumRevenueAtRisk) || minimumRevenueAtRisk < 0) throw new Error("Minimum revenue at risk must be 0 or more.");
    if (!Number.isFinite(minimumConfidencePct) || minimumConfidencePct < 0 || minimumConfidencePct > 100) throw new Error("Minimum confidence must be between 0 and 100.");
    if (!Number.isInteger(dailyActionCap) || dailyActionCap < 1 || dailyActionCap > 1000) throw new Error("Daily action cap must be between 1 and 1000.");
    const result = await db.from("autopilot_policies").update({
      enabled,
      minimum_revenue_at_risk: minimumRevenueAtRisk,
      minimum_confidence: minimumConfidencePct / 100,
      daily_action_cap: dailyActionCap,
      approval_required: true,
      external_execution_enabled: false,
      updated_by: context.user.id,
    }).eq("organization_id", context.organization.id).eq("id", id).select("id").single();
    if (result.error) throw new Error(result.error.message);
    const audit = await db.from("audit_events").insert({
      organization_id: context.organization.id,
      actor_id: context.user.id,
      entity_type: "autopilot_policy",
      entity_id: id,
      event_type: "autopilot_policy_updated",
      after_state: { enabled, minimum_revenue_at_risk: minimumRevenueAtRisk, minimum_confidence: minimumConfidencePct / 100, daily_action_cap: dailyActionCap, approval_required: true, external_execution_enabled: false },
    });
    if (audit.error) throw new Error(audit.error.message);
    revalidatePath("/app/autopilot");
    target = "/app/autopilot?saved=1";
  } catch (error) {
    target = `/app/autopilot?error=${encodeURIComponent(errorMessage(error))}`;
  }
  redirect(target);
}

export async function runAutopilotNow() {
  const context = await requireAppContext();
  let target = "/app/autopilot";
  try {
    assertCanManageInventory(context.role);
    const supabase = await createClient();
    const result = await runAutopilot(supabase as any, context.organization.id, context.user.id);
    revalidatePath("/app/autopilot");
    revalidatePath("/app/actions");
    revalidatePath("/app/ops");
    revalidatePath("/app/ai-copilot");
    target = `/app/autopilot?run=1&scanned=${result.scanned}&eligible=${result.eligible}&prepared=${result.prepared}&capped=${result.skippedDailyCap}`;
  } catch (error) {
    target = `/app/autopilot?error=${encodeURIComponent(errorMessage(error))}`;
  }
  redirect(target);
}
