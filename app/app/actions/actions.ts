"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppContext } from "@/lib/auth/session";
import { assertCanManageInventory } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

function message(error: unknown) { return error instanceof Error ? error.message : "Something went wrong."; }

async function transition(db: any, organizationId: string, actionId: string, from: string, to: string, values: Record<string, unknown> = {}) {
  const result = await db.from("actions").update({ status: to, ...values })
    .eq("organization_id", organizationId).eq("id", actionId).eq("status", from).select("id").single();
  if (result.error) throw new Error(result.error.message);
}

export async function approvePreparedAction(formData: FormData) {
  const context = await requireAppContext();
  const actionId = String(formData.get("action_id") ?? "");
  let target = `/app/actions/${actionId}`;
  try {
    assertCanManageInventory(context.role);
    const supabase = await createClient();
    const db = supabase as any;
    const actionResult = await db.from("actions").select("*")
      .eq("organization_id", context.organization.id).eq("id", actionId).single();
    if (actionResult.error) throw new Error(actionResult.error.message);
    const action = actionResult.data;
    if (action.status !== "AWAITING_APPROVAL") throw new Error("This action is no longer waiting for approval.");
    const payload = action.payload as Record<string, unknown>;

    await transition(db, context.organization.id, actionId, "AWAITING_APPROVAL", "APPROVED", { approved_by: context.user.id, approved_at: new Date().toISOString() });
    await transition(db, context.organization.id, actionId, "APPROVED", "EXECUTING");
    await transition(db, context.organization.id, actionId, "EXECUTING", "EXECUTED", {
      executed_at: new Date().toISOString(),
      external_reference: `assisted-${String(action.type).toLowerCase()}-${actionId.slice(0, 8)}`,
    });
    await transition(db, context.organization.id, actionId, "EXECUTED", "VERIFYING");

    let beforeState: Record<string, unknown> = { issue_id: action.issue_id };
    let expectedState: Record<string, unknown> = { issue_id: action.issue_id };
    if (action.type === "CREATE_TRANSFER_PLAN") {
      beforeState = { available_quantity: Number(payload.before_quantity ?? 0), location_id: payload.destination_location_id };
      expectedState = { available_quantity: Number(payload.expected_quantity ?? 0), location_id: payload.destination_location_id };
    } else if (action.type === "EXPEDITE_PO") {
      beforeState = { expected_delivery_date: payload.original_expected_delivery_date, purchase_order_id: payload.purchase_order_id };
      expectedState = { arrive_by: payload.arrive_by, purchase_order_id: payload.purchase_order_id };
    } else if (action.type === "CREATE_REPLENISHMENT_PLAN") {
      beforeState = { destination_location_id: payload.destination_location_id, requested_quantity: 0 };
      expectedState = { destination_location_id: payload.destination_location_id, requested_quantity: Number(payload.quantity ?? 0) };
    }

    const issueResult = action.issue_id ? await db.from("issues").select("estimated_revenue_at_risk").eq("organization_id", context.organization.id).eq("id", action.issue_id).maybeSingle() : { data: null, error: null };
    if (issueResult.error) throw new Error(issueResult.error.message);
    const existingOutcome = await db.from("action_outcomes").select("id").eq("organization_id", context.organization.id).eq("action_id", actionId).maybeSingle();
    if (existingOutcome.error) throw new Error(existingOutcome.error.message);
    if (!existingOutcome.data) {
      const outcome = await db.from("action_outcomes").insert({
        organization_id: context.organization.id,
        action_id: actionId,
        before_state: beforeState,
        expected_state: expectedState,
        estimated_value_protected: issueResult.data?.estimated_revenue_at_risk ?? "0.00",
        verification_status: "VERIFYING",
      });
      if (outcome.error) throw new Error(outcome.error.message);
    }

    if (action.issue_id) {
      const issueUpdate = await db.from("issues").update({ status: "running" })
        .eq("organization_id", context.organization.id).eq("id", action.issue_id);
      if (issueUpdate.error) throw new Error(issueUpdate.error.message);
    }
    const audit = await db.from("audit_events").insert({
      organization_id: context.organization.id,
      actor_id: context.user.id,
      entity_type: "action",
      entity_id: actionId,
      event_type: "copilot_prepared_action_approved",
      before_state: { status: "AWAITING_APPROVAL" },
      after_state: { status: "VERIFYING", execution_mode: "ASSISTED", external_action_performed: false },
    });
    if (audit.error) throw new Error(audit.error.message);

    revalidatePath("/app/actions");
    revalidatePath(`/app/actions/${actionId}`);
    revalidatePath("/app/ops");
    revalidatePath("/app/ai-copilot");
    target = `/app/actions/${actionId}?approved=1`;
  } catch (error) {
    target = `/app/actions/${actionId}?error=${encodeURIComponent(message(error))}`;
  }
  redirect(target);
}
