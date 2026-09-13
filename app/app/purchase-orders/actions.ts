"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppContext } from "@/lib/auth/session";
import { assertCanManageInventory } from "@/lib/auth/roles";
import { runPurchaseOrderIntelligence } from "@/lib/purchase-orders/engine";
import { createClient } from "@/lib/supabase/server";

function message(error: unknown) { return error instanceof Error ? error.message : "Something went wrong."; }

async function transition(db: any, organizationId: string, actionId: string, from: string, to: string, values: Record<string, unknown> = {}) {
  const result = await db.from("actions").update({ status: to, ...values })
    .eq("organization_id", organizationId).eq("id", actionId).eq("status", from).select("id").single();
  if (result.error) throw new Error(result.error.message);
}

export async function refreshPurchaseOrders() {
  const context = await requireAppContext();
  try {
    assertCanManageInventory(context.role);
    const supabase = await createClient();
    const result = await runPurchaseOrderIntelligence(supabase as any, context.organization.id, context.user.id);
    revalidatePath("/app/purchase-orders");
    revalidatePath("/app/ops");
    redirect(`/app/purchase-orders?scan=${result.assessedLines}&risk=${result.risks}`);
  } catch (error) {
    redirect(`/app/purchase-orders?error=${encodeURIComponent(message(error))}`);
  }
}

export async function recordPurchaseOrderReceipt(formData: FormData) {
  const context = await requireAppContext();
  const poId = String(formData.get("po_id") ?? "");
  const lineId = String(formData.get("line_id") ?? "");
  try {
    assertCanManageInventory(context.role);
    const received = Number(formData.get("received_quantity"));
    if (!Number.isInteger(received) || received < 0) throw new Error("Received quantity must be a non-negative whole number.");
    const supabase = await createClient();
    const db = supabase as any;
    const line = await db.from("purchase_order_lines").select("*")
      .eq("organization_id", context.organization.id).eq("purchase_order_id", poId).eq("id", lineId).single();
    if (line.error) throw new Error(line.error.message);
    const maximum = Number(line.data.confirmed_quantity ?? line.data.ordered_quantity);
    if (received > maximum) throw new Error(`Received quantity cannot exceed ${maximum}.`);
    const updated = await db.from("purchase_order_lines").update({ received_quantity: received })
      .eq("organization_id", context.organization.id).eq("id", lineId);
    if (updated.error) throw new Error(updated.error.message);
    await runPurchaseOrderIntelligence(supabase as any, context.organization.id, context.user.id);
    revalidatePath(`/app/purchase-orders/${poId}`);
    revalidatePath("/app/purchase-orders");
    revalidatePath("/app/ops");
  } catch (error) {
    redirect(`/app/purchase-orders/${poId}?error=${encodeURIComponent(message(error))}`);
  }
  redirect(`/app/purchase-orders/${poId}?received=1`);
}

export async function approveExpeditePurchaseOrder(formData: FormData) {
  const context = await requireAppContext();
  const issueId = String(formData.get("issue_id") ?? "");
  try {
    assertCanManageInventory(context.role);
    const supabase = await createClient();
    const db = supabase as any;
    const issue = await db.from("issues").select("*")
      .eq("organization_id", context.organization.id).eq("id", issueId).single();
    if (issue.error) throw new Error(issue.error.message);
    const metadata = issue.data.metadata as Record<string, unknown>;
    if (String(metadata.recommendation_type ?? "") !== "EXPEDITE_PO") throw new Error("This issue is not an expedite recommendation.");
    const poId = String(metadata.purchase_order_id ?? "");
    const po = await db.from("purchase_orders").select("*")
      .eq("organization_id", context.organization.id).eq("id", poId).single();
    if (po.error) throw new Error(po.error.message);
    const idempotencyKey = `${context.organization.id}:issue:${issueId}:expedite-po:v1`;
    const existing = await db.from("actions").select("*")
      .eq("organization_id", context.organization.id).eq("idempotency_key", idempotencyKey).maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data) redirect(`/app/actions/${existing.data.id}`);

    const arriveBy = String(metadata.projected_stockout_at ?? po.data.expected_delivery_date);
    const payload = {
      purchase_order_id: po.data.id,
      po_number: po.data.external_po_number,
      supplier_name: po.data.supplier_name,
      original_expected_delivery_date: po.data.expected_delivery_date,
      arrive_by: arriveBy,
      internal_task: `Request an earlier arrival for PO ${po.data.external_po_number} from ${po.data.supplier_name}.`,
      supplier_request: `Please review PO ${po.data.external_po_number}. Current demand indicates stock may run out before the expected arrival. Please confirm whether delivery can be expedited to ${new Date(arriveBy).toLocaleDateString("en-IN")}.`,
      external_contact_performed: false,
    };
    const created = await db.from("actions").insert({
      organization_id: context.organization.id,
      issue_id: issueId,
      type: "EXPEDITE_PO",
      status: "CREATED",
      requested_by: context.user.id,
      execution_mode: "ASSISTED",
      payload,
      idempotency_key: idempotencyKey,
    }).select("*").single();
    if (created.error) throw new Error(created.error.message);
    const actionId = created.data.id;
    await transition(db, context.organization.id, actionId, "CREATED", "VALIDATED");
    await transition(db, context.organization.id, actionId, "VALIDATED", "AWAITING_APPROVAL");
    await transition(db, context.organization.id, actionId, "AWAITING_APPROVAL", "APPROVED", { approved_by: context.user.id, approved_at: new Date().toISOString() });
    await transition(db, context.organization.id, actionId, "APPROVED", "EXECUTING");
    await transition(db, context.organization.id, actionId, "EXECUTING", "EXECUTED", { executed_at: new Date().toISOString(), external_reference: `assisted-expedite-${actionId.slice(0, 8)}` });
    await transition(db, context.organization.id, actionId, "EXECUTED", "VERIFYING");
    const outcome = await db.from("action_outcomes").insert({
      organization_id: context.organization.id,
      action_id: actionId,
      before_state: { expected_delivery_date: po.data.expected_delivery_date, purchase_order_id: po.data.id },
      expected_state: { arrive_by: arriveBy, purchase_order_id: po.data.id },
      estimated_value_protected: issue.data.estimated_revenue_at_risk ?? "0.00",
      verification_status: "VERIFYING",
    });
    if (outcome.error) throw new Error(outcome.error.message);
    const issueUpdate = await db.from("issues").update({ status: "running" })
      .eq("organization_id", context.organization.id).eq("id", issueId);
    if (issueUpdate.error) throw new Error(issueUpdate.error.message);
    const audit = await db.from("audit_events").insert({
      organization_id: context.organization.id,
      actor_id: context.user.id,
      entity_type: "action",
      entity_id: actionId,
      event_type: "expedite_request_prepared",
      before_state: null,
      after_state: payload,
    });
    if (audit.error) throw new Error(audit.error.message);
    revalidatePath("/app/ops");
    revalidatePath("/app/purchase-orders");
    redirect(`/app/actions/${actionId}?approved=1`);
  } catch (error) {
    redirect(`/app/ops/issues/${issueId}?error=${encodeURIComponent(message(error))}`);
  }
}
