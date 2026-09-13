import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";

export type CopilotProposalType = "CREATE_TRANSFER_PLAN" | "CREATE_REPLENISHMENT_PLAN" | "EXPEDITE_PO" | "CREATE_ORDER_RECOVERY_TASK" | "CREATE_RETURN_RECOVERY_TASK";

export type CopilotActionProposal = { issueId: string; type: CopilotProposalType; label: string; summary: string; estimatedValueProtected: number; href: string; };
function asRecord(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }

export async function prepareCopilotAction(supabase: SupabaseClient<Database>, organizationId: string, actorId: string, issueId: string, requestedType: CopilotProposalType) {
  const db = supabase as any;
  const [issueResult, recommendationResult] = await Promise.all([
    db.from("issues").select("*").eq("organization_id", organizationId).eq("id", issueId).single(),
    db.from("issue_recommendations").select("*").eq("organization_id", organizationId).eq("issue_id", issueId).maybeSingle(),
  ]);
  if (issueResult.error) throw new Error("The referenced issue is no longer available.");
  if (recommendationResult.error) throw new Error(recommendationResult.error.message);
  const issue = issueResult.data;
  if (["resolved", "ignored"].includes(issue.status)) throw new Error("This issue is already closed.");
  const metadata = asRecord(issue.metadata); const recommendation = recommendationResult.data;
  const idempotencyKey = `${organizationId}:copilot:${issueId}:${requestedType}:v1`;
  const existing = await db.from("actions").select("id,status").eq("organization_id", organizationId).eq("idempotency_key", idempotencyKey).maybeSingle();
  if (existing.error) throw new Error(existing.error.message); if (existing.data) return { actionId: existing.data.id, created: false };
  let payload: Json; let estimatedValueProtected = Number(issue.estimated_revenue_at_risk ?? 0);

  if (requestedType === "CREATE_RETURN_RECOVERY_TASK") {
    if (!issue.return_id || !["RETURN_STUCK", "REFUND_DELAYED", "RETURN_RECEIPT_DELAYED"].includes(String(issue.type))) throw new Error("This issue does not currently have a return/RTO recovery recommendation.");
    payload = { prepared_by: "AI_COPILOT", return_id: issue.return_id, external_return_id: metadata.external_return_id, order_id: metadata.order_id, kind: metadata.kind, status: metadata.status, issue_type: issue.type, refund_amount: metadata.refund_amount, reverse_logistics_cost: metadata.reverse_logistics_cost, recommendation_title: metadata.recommendation_title, recommendation_detail: metadata.recommendation_detail, internal_task: metadata.internal_task, external_action_performed: false } as Json;
  } else if (requestedType === "CREATE_ORDER_RECOVERY_TASK") {
    if (!issue.order_id || !["ORDER_DELAYED", "ORDER_STUCK", "RTO_RISK"].includes(String(issue.type))) throw new Error("This issue does not currently have an order-recovery recommendation.");
    payload = { prepared_by: "AI_COPILOT", order_id: issue.order_id, external_order_id: metadata.external_order_id, issue_type: issue.type, payment_method: metadata.payment_method, fulfillment_status: metadata.fulfillment_status, delivery_attempts: metadata.delivery_attempts, recommendation_title: metadata.recommendation_title, recommendation_detail: metadata.recommendation_detail, internal_task: metadata.internal_task, external_action_performed: false } as Json;
  } else {
    if (!issue.sku_id) throw new Error("The SKU for this issue is no longer available.");
    const skuResult = await db.from("skus").select("*").eq("organization_id", organizationId).eq("id", issue.sku_id).single();
    if (skuResult.error) throw new Error("The SKU for this issue is no longer available.");
    const sku = skuResult.data;
    if (requestedType === "CREATE_TRANSFER_PLAN") {
      if (!recommendation?.source_location_id) throw new Error("Actnivo does not currently have a safe transfer recommendation for this issue.");
      const [sourceResult, destinationResult] = await Promise.all([db.from("locations").select("*").eq("organization_id", organizationId).eq("id", recommendation.source_location_id).single(), db.from("locations").select("*").eq("organization_id", organizationId).eq("id", recommendation.destination_location_id).single()]);
      if (sourceResult.error || destinationResult.error) throw new Error("The recommended transfer locations are no longer available.");
      const calculation = asRecord(recommendation.calculation); estimatedValueProtected = Number(recommendation.estimated_revenue_protected ?? estimatedValueProtected);
      payload = { prepared_by: "AI_COPILOT", sku_id: sku.id, master_sku: sku.master_sku, product_name: sku.product_name, channel: issue.channel, source_location_id: sourceResult.data.id, source_location: sourceResult.data.name, destination_location_id: destinationResult.data.id, destination_location: destinationResult.data.name, quantity: recommendation.quantity, before_quantity: Number(calculation.destination_available ?? 0), expected_quantity: Number(calculation.destination_available ?? 0) + Number(recommendation.quantity), selling_price: Number(sku.selling_price), internal_task: `Transfer ${recommendation.quantity} units of ${sku.master_sku} from ${sourceResult.data.name} to ${destinationResult.data.name}.`, external_action_performed: false } as Json;
    } else if (requestedType === "EXPEDITE_PO") {
      if (String(metadata.recommendation_type ?? "") !== "EXPEDITE_PO") throw new Error("This issue does not currently have an expedite recommendation.");
      const poId = String(metadata.purchase_order_id ?? ""); const poResult = await db.from("purchase_orders").select("*").eq("organization_id", organizationId).eq("id", poId).single(); if (poResult.error) throw new Error("The purchase order for this issue is no longer available.");
      const arriveBy = String(metadata.projected_stockout_at ?? poResult.data.expected_delivery_date);
      payload = { prepared_by: "AI_COPILOT", purchase_order_id: poResult.data.id, po_number: poResult.data.external_po_number, supplier_name: poResult.data.supplier_name, original_expected_delivery_date: poResult.data.expected_delivery_date, arrive_by: arriveBy, sku_id: sku.id, master_sku: sku.master_sku, internal_task: `Request an earlier arrival for PO ${poResult.data.external_po_number} from ${poResult.data.supplier_name}.`, supplier_request: `Please review PO ${poResult.data.external_po_number}. Current demand indicates stock may run out before the expected arrival. Please confirm whether delivery can be expedited to ${new Date(arriveBy).toLocaleDateString("en-IN")}.`, external_contact_performed: false } as Json;
    } else {
      const destinationId = issue.location_id; if (!destinationId) throw new Error("This issue does not have a destination location for replenishment.");
      const destinationResult = await db.from("locations").select("*").eq("organization_id", organizationId).eq("id", destinationId).single(); if (destinationResult.error) throw new Error("The destination location is no longer available.");
      const quantity = Math.max(1, Number(issue.estimated_shortage_units ?? 0)); payload = { prepared_by: "AI_COPILOT", sku_id: sku.id, master_sku: sku.master_sku, product_name: sku.product_name, destination_location_id: destinationResult.data.id, destination_location: destinationResult.data.name, quantity, selling_price: Number(sku.selling_price), internal_task: `Replenish ${quantity} units of ${sku.master_sku} into ${destinationResult.data.name}.`, external_action_performed: false } as Json;
    }
  }
  const created = await db.from("actions").insert({ organization_id: organizationId, issue_id: issueId, type: requestedType, status: "AWAITING_APPROVAL", requested_by: actorId, execution_mode: "ASSISTED", payload, idempotency_key: idempotencyKey }).select("id").single();
  if (created.error) throw new Error(created.error.message);
  const issueUpdate = await db.from("issues").update({ status: "needs_approval" }).eq("organization_id", organizationId).eq("id", issueId).neq("status", "ignored").neq("status", "resolved"); if (issueUpdate.error) throw new Error(issueUpdate.error.message);
  const audit = await db.from("audit_events").insert({ organization_id: organizationId, actor_id: actorId, entity_type: "action", entity_id: created.data.id, event_type: "copilot_action_prepared", before_state: null, after_state: { type: requestedType, issue_id: issueId, estimated_value_protected: estimatedValueProtected, payload } as Json }); if (audit.error) throw new Error(audit.error.message);
  return { actionId: created.data.id, created: true };
}
