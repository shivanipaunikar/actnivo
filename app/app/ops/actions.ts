"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppContext } from "@/lib/auth/session";
import { assertCanManageInventory } from "@/lib/auth/roles";
import { runOperatingLoop } from "@/lib/operations/engine";
import { createActionIdempotencyKey } from "@/lib/operations/forecasting";
import type { ActionStatus, Database, Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

function errorMessage(error: unknown) { return error instanceof Error ? error.message : "Something went wrong."; }

async function logEvent(supabase: SupabaseClient<Database>, organizationId: string, actorId: string, entityType: string, entityId: string, eventType: string, before: Json | null, after: Json | null) {
  const result = await supabase.from("audit_events").insert({ organization_id: organizationId, actor_id: actorId, entity_type: entityType, entity_id: entityId, event_type: eventType, before_state: before, after_state: after });
  if (result.error) throw new Error(result.error.message);
}

async function transition(supabase: SupabaseClient<Database>, organizationId: string, actionId: string, from: ActionStatus, to: ActionStatus, values: Record<string, unknown> = {}) {
  const result = await supabase.from("actions").update({ status: to, ...values }).eq("organization_id", organizationId).eq("id", actionId).eq("status", from).select("id").single();
  if (result.error) throw new Error(result.error.message);
}

export async function refreshOperations() {
  const context = await requireAppContext();
  let target = "/app/ops";
  try {
    assertCanManageInventory(context.role);
    const supabase = await createClient();
    const result = await runOperatingLoop(supabase, context.organization, context.user.id);
    revalidatePath("/app/ops");
    target = `/app/ops?scan=${result.calculations}`;
  } catch (error) {
    target = `/app/ops?error=${encodeURIComponent(errorMessage(error))}`;
  }
  redirect(target);
}

export async function ignoreIssue(formData: FormData) {
  const context = await requireAppContext();
  const issueId = String(formData.get("issue_id") ?? "");
  try {
    assertCanManageInventory(context.role);
    const supabase = await createClient();
    const existing = await supabase.from("issues").select("*").eq("organization_id", context.organization.id).eq("id", issueId).single();
    if (existing.error) throw new Error(existing.error.message);
    const updated = await supabase.from("issues").update({ status: "ignored", resolved_at: new Date().toISOString() }).eq("organization_id", context.organization.id).eq("id", issueId);
    if (updated.error) throw new Error(updated.error.message);
    await logEvent(supabase, context.organization.id, context.user.id, "issue", issueId, "issue_ignored", existing.data as unknown as Json, { status: "ignored" });
    revalidatePath("/app/ops");
  } catch (error) {
    redirect(`/app/ops/issues/${issueId}?error=${encodeURIComponent(errorMessage(error))}`);
  }
  redirect("/app/ops?status=ignored");
}

export async function modifyRecommendation(formData: FormData) {
  const context = await requireAppContext();
  const issueId = String(formData.get("issue_id") ?? "");
  try {
    assertCanManageInventory(context.role);
    const quantity = Number(formData.get("quantity"));
    const supabase = await createClient();
    const existing = await supabase.from("issue_recommendations").select("*").eq("organization_id", context.organization.id).eq("issue_id", issueId).single();
    if (existing.error) throw new Error(existing.error.message);
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > existing.data.quantity) throw new Error(`Choose a whole-unit quantity between 1 and ${existing.data.quantity}.`);
    const calculation = existing.data.calculation as Record<string, number>;
    const denominator = Number(calculation.minimum_safe_denominator ?? 0.1);
    const sourceCoverage = (Number(calculation.source_available) - quantity) / Math.max(Number(calculation.source_velocity), denominator);
    const destinationCoverage = (Number(calculation.destination_available) + quantity) / Math.max(Number(calculation.destination_velocity), denominator);
    const after = { quantity, estimated_revenue_protected: (quantity * Number(calculation.selling_price)).toFixed(2), source_coverage_after: sourceCoverage.toFixed(4), destination_coverage_after: destinationCoverage.toFixed(4) };
    const updated = await supabase.from("issue_recommendations").update(after).eq("organization_id", context.organization.id).eq("id", existing.data.id);
    if (updated.error) throw new Error(updated.error.message);
    await logEvent(supabase, context.organization.id, context.user.id, "issue", issueId, "action_modified", existing.data as unknown as Json, after as unknown as Json);
    revalidatePath(`/app/ops/issues/${issueId}`);
  } catch (error) {
    redirect(`/app/ops/issues/${issueId}?error=${encodeURIComponent(errorMessage(error))}`);
  }
  redirect(`/app/ops/issues/${issueId}?modified=1`);
}

export async function approveIssue(formData: FormData) {
  const context = await requireAppContext();
  const issueId = String(formData.get("issue_id") ?? "");
  let target = `/app/ops/issues/${issueId}`;
  try {
    assertCanManageInventory(context.role);
    const supabase = await createClient();
    const [issueResult, recommendationResult] = await Promise.all([
      supabase.from("issues").select("*").eq("organization_id", context.organization.id).eq("id", issueId).single(),
      supabase.from("issue_recommendations").select("*").eq("organization_id", context.organization.id).eq("issue_id", issueId).single(),
    ]);
    if (issueResult.error) throw new Error(issueResult.error.message);
    if (recommendationResult.error) throw new Error("This issue does not have an executable transfer recommendation.");
    const issue = issueResult.data;
    const recommendation = recommendationResult.data;
    const idempotencyKey = createActionIdempotencyKey(context.organization.id, issue.id);
    const existing = await supabase.from("actions").select("*").eq("organization_id", context.organization.id).eq("idempotency_key", idempotencyKey).maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data) {
      target = `/app/actions/${existing.data.id}`;
    } else {
    const [sku, source, destination] = await Promise.all([
      supabase.from("skus").select("*").eq("organization_id", context.organization.id).eq("id", issue.sku_id).single(),
      supabase.from("locations").select("*").eq("organization_id", context.organization.id).eq("id", recommendation.source_location_id!).single(),
      supabase.from("locations").select("*").eq("organization_id", context.organization.id).eq("id", recommendation.destination_location_id).single(),
    ]);
    if (sku.error || source.error || destination.error) throw new Error("The transfer locations or SKU are no longer available.");
    const calculation = recommendation.calculation as Record<string, number>;
    const payload = {
      sku_id: sku.data.id, master_sku: sku.data.master_sku, product_name: sku.data.product_name, channel: issue.channel,
      source_location_id: source.data.id, source_location: source.data.name, destination_location_id: destination.data.id, destination_location: destination.data.name,
      quantity: recommendation.quantity, before_quantity: Number(calculation.destination_available),
      expected_quantity: Number(calculation.destination_available) + recommendation.quantity, selling_price: Number(sku.data.selling_price),
      internal_task: `Transfer ${recommendation.quantity} units of ${sku.data.master_sku} from ${source.data.name} to ${destination.data.name}.`,
    } as Json;
    const created = await supabase.from("actions").insert({ organization_id: context.organization.id, issue_id: issue.id, type: "CREATE_TRANSFER_PLAN", status: "CREATED", requested_by: context.user.id, execution_mode: "ASSISTED", payload, idempotency_key: idempotencyKey }).select("*").single();
    if (created.error) throw new Error(created.error.message);
    const actionId = created.data.id;
    await transition(supabase, context.organization.id, actionId, "CREATED", "VALIDATED");
    await transition(supabase, context.organization.id, actionId, "VALIDATED", "AWAITING_APPROVAL");
    await transition(supabase, context.organization.id, actionId, "AWAITING_APPROVAL", "APPROVED", { approved_by: context.user.id, approved_at: new Date().toISOString() });
    await transition(supabase, context.organization.id, actionId, "APPROVED", "EXECUTING");
    await transition(supabase, context.organization.id, actionId, "EXECUTING", "EXECUTED", { executed_at: new Date().toISOString(), external_reference: `assisted-transfer-${actionId.slice(0, 8)}` });
    await transition(supabase, context.organization.id, actionId, "EXECUTED", "VERIFYING");
    const outcome = await supabase.from("action_outcomes").insert({ organization_id: context.organization.id, action_id: actionId, before_state: { available_quantity: Number(calculation.destination_available), location_id: destination.data.id }, expected_state: { available_quantity: Number(calculation.destination_available) + recommendation.quantity, location_id: destination.data.id }, estimated_value_protected: recommendation.estimated_revenue_protected, verification_status: "VERIFYING" });
    if (outcome.error) throw new Error(outcome.error.message);
    const issueUpdate = await supabase.from("issues").update({ status: "running" }).eq("organization_id", context.organization.id).eq("id", issue.id);
    if (issueUpdate.error) throw new Error(issueUpdate.error.message);
    await logEvent(supabase, context.organization.id, context.user.id, "action", actionId, "action_approved", null, payload);
    await logEvent(supabase, context.organization.id, context.user.id, "action", actionId, "action_executed", null, { execution_mode: "ASSISTED", artifact: `/app/actions/${actionId}/transfer.csv` });
    revalidatePath("/app/ops");
    target = `/app/actions/${actionId}?approved=1`;
    }
  } catch (error) {
    target = `/app/ops/issues/${issueId}?error=${encodeURIComponent(errorMessage(error))}`;
  }
  redirect(target);
}
