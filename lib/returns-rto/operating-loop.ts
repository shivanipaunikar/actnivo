import type { SupabaseClient } from "@supabase/supabase-js";
import { buildReturnRecoveryRecommendation, detectReturnException } from "./intelligence";

export async function runReturnsRtoOperatingLoop(supabase: SupabaseClient<any>, organizationId: string, actorId: string, now = new Date()) {
  const db = supabase as any;
  const [returnsResult, linesResult, activeIssuesResult] = await Promise.all([
    db.from("returns_rto").select("*").eq("organization_id", organizationId),
    db.from("return_rto_lines").select("return_id,sku_id").eq("organization_id", organizationId),
    db.from("issues").select("*").eq("organization_id", organizationId).not("return_id", "is", null).in("status", ["open", "needs_approval", "running"]),
  ]);
  for (const result of [returnsResult, linesResult, activeIssuesResult]) if (result.error) throw new Error(result.error.message);
  const firstSku = new Map<string, string>();
  for (const line of linesResult.data ?? []) if (!firstSku.has(line.return_id)) firstSku.set(line.return_id, line.sku_id);
  const activeByKey = new Map<string, any>((activeIssuesResult.data ?? []).map((issue: any) => [`${issue.return_id}|${issue.type}`, issue]));
  const seen = new Set<string>();
  let created = 0, updated = 0, resolved = 0;

  for (const row of returnsResult.data ?? []) {
    const exception = detectReturnException(row, now);
    if (!exception) continue;
    const recommendation = buildReturnRecoveryRecommendation(exception, row.kind);
    const metadata = {
      return_id: row.id,
      external_return_id: row.external_return_id,
      order_id: row.order_id,
      kind: row.kind,
      status: row.status,
      reason: row.reason,
      refund_amount: Number(row.refund_amount ?? 0),
      reverse_logistics_cost: Number(row.reverse_logistics_cost ?? 0),
      recommendation_type: "CREATE_RETURN_RECOVERY_TASK",
      recommendation_title: recommendation.title,
      recommendation_detail: recommendation.detail,
      internal_task: recommendation.task,
      external_action_performed: false,
    };
    const key = `${row.id}|${exception.type}`;
    const existing = activeByKey.get(key);
    if (existing) {
      const update = await db.from("issues").update({ severity: exception.severity, title: exception.title, summary: exception.summary, estimated_revenue_at_risk: exception.revenueAtRisk, metadata }).eq("organization_id", organizationId).eq("id", existing.id);
      if (update.error) throw new Error(update.error.message);
      seen.add(existing.id); updated += 1;
    } else {
      const inserted = await db.from("issues").insert({ organization_id: organizationId, type: exception.type, severity: exception.severity, status: "open", sku_id: firstSku.get(row.id) ?? null, return_id: row.id, title: exception.title, summary: exception.summary, estimated_revenue_at_risk: exception.revenueAtRisk, metadata }).select("id").single();
      if (inserted.error) throw new Error(inserted.error.message);
      seen.add(inserted.data.id); created += 1;
      const audit = await db.from("audit_events").insert({ organization_id: organizationId, actor_id: actorId, entity_type: "issue", entity_id: inserted.data.id, event_type: "return_exception_detected", after_state: { return_id: row.id, type: exception.type, revenue_at_risk: exception.revenueAtRisk } });
      if (audit.error) throw new Error(audit.error.message);
    }
  }

  for (const issue of activeIssuesResult.data ?? []) {
    if (seen.has(issue.id)) continue;
    const update = await db.from("issues").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("organization_id", organizationId).eq("id", issue.id);
    if (update.error) throw new Error(update.error.message);
    const actions = await db.from("actions").select("id,status").eq("organization_id", organizationId).eq("issue_id", issue.id).eq("type", "CREATE_RETURN_RECOVERY_TASK");
    if (actions.error) throw new Error(actions.error.message);
    for (const action of actions.data ?? []) if (action.status === "VERIFYING") {
      const outcome = await db.from("action_outcomes").update({ actual_state: { return_exception_active: false }, actual_value_protected: Number(issue.estimated_revenue_at_risk ?? 0), success: true, verification_status: "SUCCESS", verified_at: new Date().toISOString() }).eq("organization_id", organizationId).eq("action_id", action.id);
      if (outcome.error) throw new Error(outcome.error.message);
      const verified = await db.from("actions").update({ status: "VERIFIED" }).eq("organization_id", organizationId).eq("id", action.id).eq("status", "VERIFYING");
      if (verified.error) throw new Error(verified.error.message);
    }
    resolved += 1;
  }
  return { created, updated, resolved, scanned: (returnsResult.data ?? []).length };
}
