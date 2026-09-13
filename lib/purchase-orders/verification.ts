import type { Json } from "@/lib/supabase/database.types";

export async function verifyExpediteActions(db: any, organizationId: string, actorId: string) {
  const actions = await db.from("actions").select("*")
    .eq("organization_id", organizationId).eq("type", "EXPEDITE_PO").eq("status", "VERIFYING");
  if (actions.error) throw new Error(actions.error.message);

  for (const action of actions.data ?? []) {
    const payload = action.payload as Record<string, unknown>;
    const poId = String(payload.purchase_order_id ?? "");
    if (!poId) continue;
    const po = await db.from("purchase_orders").select("*")
      .eq("organization_id", organizationId).eq("id", poId).maybeSingle();
    if (po.error) throw new Error(po.error.message);
    if (!po.data?.actual_delivery_date) continue;

    const arriveBy = new Date(String(payload.arrive_by ?? po.data.expected_delivery_date));
    const actual = new Date(po.data.actual_delivery_date);
    const success = actual.getTime() <= arriveBy.getTime();
    const outcome = await db.from("action_outcomes").select("*")
      .eq("organization_id", organizationId).eq("action_id", action.id).single();
    if (outcome.error) throw new Error(outcome.error.message);

    const actualState = {
      purchase_order_id: poId,
      actual_delivery_date: po.data.actual_delivery_date,
      arrive_by: arriveBy.toISOString(),
    };
    const outcomeUpdate = await db.from("action_outcomes").update({
      actual_state: actualState,
      success,
      verification_status: success ? "SUCCESS" : "FAILED",
      actual_value_protected: success ? outcome.data.estimated_value_protected : "0.00",
      verified_at: new Date().toISOString(),
    }).eq("organization_id", organizationId).eq("id", outcome.data.id);
    if (outcomeUpdate.error) throw new Error(outcomeUpdate.error.message);

    const actionUpdate = await db.from("actions").update({ status: success ? "VERIFIED" : "FAILED" })
      .eq("organization_id", organizationId).eq("id", action.id);
    if (actionUpdate.error) throw new Error(actionUpdate.error.message);

    if (action.issue_id) {
      const issueUpdate = await db.from("issues").update({
        status: success ? "resolved" : "needs_approval",
        resolved_at: success ? new Date().toISOString() : null,
      }).eq("organization_id", organizationId).eq("id", action.issue_id);
      if (issueUpdate.error) throw new Error(issueUpdate.error.message);
    }

    const audit = await db.from("audit_events").insert({
      organization_id: organizationId,
      actor_id: actorId,
      entity_type: "action",
      entity_id: action.id,
      event_type: "po_action_verified",
      before_state: null,
      after_state: actualState as Json,
    });
    if (audit.error) throw new Error(audit.error.message);
  }
}
