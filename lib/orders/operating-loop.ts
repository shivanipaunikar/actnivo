import type { SupabaseClient } from "@supabase/supabase-js";
import { detectOrderException } from "./intelligence";

function recommendationFor(type: string, attempts: number) {
  if (type === "RTO_RISK") {
    return {
      title: attempts >= 2 ? "Create urgent RTO recovery task" : "Create customer recovery task",
      detail: attempts >= 2 ? "Prioritize customer confirmation before the next delivery attempt." : "Confirm delivery availability before another attempt.",
      task: attempts >= 2 ? "Urgently contact the customer, confirm delivery availability and address details, and coordinate the next delivery attempt. Do not mark contact as completed until your team actually performs it." : "Contact the customer to confirm delivery availability and address details before the next attempt. Do not mark contact as completed until your team actually performs it.",
    };
  }
  if (type === "ORDER_STUCK") {
    return {
      title: "Create fulfillment escalation task",
      detail: "Escalate the order to fulfillment and confirm a ship plan.",
      task: "Escalate this order to the fulfillment team, identify the blocking step, and confirm a revised shipment plan. No carrier or OMS action is claimed until an integration performs it.",
    };
  }
  return {
    title: "Create fulfillment follow-up task",
    detail: "Review the missed ship promise before it becomes a stuck order.",
    task: "Review this delayed order with the fulfillment team and confirm whether it can ship immediately or needs escalation. No external action is claimed until an integration performs it.",
  };
}

async function verifyResolvedActions(db: any, organizationId: string, issueId: string, revenueAtRisk: number) {
  const actionsResult = await db.from("actions").select("*")
    .eq("organization_id", organizationId).eq("issue_id", issueId).eq("type", "CREATE_ORDER_RECOVERY_TASK");
  if (actionsResult.error) throw new Error(actionsResult.error.message);
  for (const action of actionsResult.data ?? []) {
    if (action.status !== "VERIFYING") continue;
    const outcomeResult = await db.from("action_outcomes").select("*")
      .eq("organization_id", organizationId).eq("action_id", action.id).maybeSingle();
    if (outcomeResult.error) throw new Error(outcomeResult.error.message);
    if (outcomeResult.data) {
      const updateOutcome = await db.from("action_outcomes").update({
        actual_state: { order_exception_active: false },
        actual_value_protected: revenueAtRisk,
        success: true,
        verification_status: "SUCCESS",
        verified_at: new Date().toISOString(),
      }).eq("organization_id", organizationId).eq("id", outcomeResult.data.id);
      if (updateOutcome.error) throw new Error(updateOutcome.error.message);
    }
    const verifyAction = await db.from("actions").update({ status: "VERIFIED" })
      .eq("organization_id", organizationId).eq("id", action.id).eq("status", "VERIFYING");
    if (verifyAction.error) throw new Error(verifyAction.error.message);
  }
}

export async function runOrderOperatingLoop(
  supabase: SupabaseClient<any>,
  organizationId: string,
  actorId: string,
  now = new Date(),
) {
  const db = supabase as any;
  const [ordersResult, linesResult] = await Promise.all([
    db.from("orders").select("*").eq("organization_id", organizationId),
    db.from("order_lines").select("order_id,sku_id").eq("organization_id", organizationId),
  ]);
  if (ordersResult.error) throw new Error(ordersResult.error.message);
  if (linesResult.error) throw new Error(linesResult.error.message);
  const firstSkuByOrder = new Map<string, string>();
  for (const line of linesResult.data ?? []) if (!firstSkuByOrder.has(line.order_id)) firstSkuByOrder.set(line.order_id, line.sku_id);

  const activeIssuesResult = await db.from("issues").select("*")
    .eq("organization_id", organizationId).not("order_id", "is", null)
    .in("status", ["open", "needs_approval", "running"]);
  if (activeIssuesResult.error) throw new Error(activeIssuesResult.error.message);
  const activeByOrderAndType = new Map<string, any>(
    (activeIssuesResult.data ?? []).map((issue: any): [string, any] => [`${issue.order_id}|${issue.type}`, issue]),
  );
  const seenIssueIds = new Set<string>();
  let created = 0;
  let updated = 0;
  let resolved = 0;

  for (const order of ordersResult.data ?? []) {
    const exception = detectOrderException(order, now);
    if (!exception) continue;
    const key = `${order.id}|${exception.type}`;
    const recommendation = recommendationFor(exception.type, Number(order.delivery_attempts ?? 0));
    const metadata = {
      order_id: order.id,
      external_order_id: order.external_order_id,
      payment_method: order.payment_method,
      fulfillment_status: order.fulfillment_status,
      delivery_attempts: order.delivery_attempts,
      recommendation_type: "CREATE_ORDER_RECOVERY_TASK",
      recommendation_title: recommendation.title,
      recommendation_detail: recommendation.detail,
      internal_task: recommendation.task,
      external_action_performed: false,
    };
    const existing = activeByOrderAndType.get(key);
    if (existing) {
      const result = await db.from("issues").update({
        severity: exception.severity,
        title: exception.title,
        summary: exception.summary,
        estimated_revenue_at_risk: exception.revenueAtRisk,
        metadata,
      }).eq("organization_id", organizationId).eq("id", existing.id);
      if (result.error) throw new Error(result.error.message);
      seenIssueIds.add(existing.id);
      updated += 1;
    } else {
      const insertResult = await db.from("issues").insert({
        organization_id: organizationId,
        type: exception.type,
        severity: exception.severity,
        status: "open",
        sku_id: firstSkuByOrder.get(order.id) ?? null,
        location_id: order.location_id,
        channel: order.channel,
        order_id: order.id,
        title: exception.title,
        summary: exception.summary,
        estimated_revenue_at_risk: exception.revenueAtRisk,
        metadata,
      }).select("id").single();
      if (insertResult.error) throw new Error(insertResult.error.message);
      seenIssueIds.add(insertResult.data.id);
      const audit = await db.from("audit_events").insert({
        organization_id: organizationId,
        actor_id: actorId,
        entity_type: "issue",
        entity_id: insertResult.data.id,
        event_type: "order_exception_detected",
        after_state: { order_id: order.id, type: exception.type, revenue_at_risk: exception.revenueAtRisk },
      });
      if (audit.error) throw new Error(audit.error.message);
      created += 1;
    }
  }

  for (const issue of activeIssuesResult.data ?? []) {
    if (seenIssueIds.has(issue.id)) continue;
    const update = await db.from("issues").update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("organization_id", organizationId).eq("id", issue.id);
    if (update.error) throw new Error(update.error.message);
    await verifyResolvedActions(db, organizationId, issue.id, Number(issue.estimated_revenue_at_risk ?? 0));
    const audit = await db.from("audit_events").insert({
      organization_id: organizationId,
      actor_id: actorId,
      entity_type: "issue",
      entity_id: issue.id,
      event_type: "order_exception_resolved",
      before_state: { status: issue.status },
      after_state: { status: "resolved", order_id: issue.order_id },
    });
    if (audit.error) throw new Error(audit.error.message);
    resolved += 1;
  }

  return { created, updated, resolved, scanned: (ordersResult.data ?? []).length };
}
