import type { Json } from "@/lib/supabase/database.types";

export const ACTIVE_PO_ISSUE_STATUSES = ["open", "needs_approval", "running"];
export const PO_ISSUE_TYPES = ["PO_LATE", "PO_SHORTAGE", "PO_ARRIVES_AFTER_STOCKOUT", "PO_PARTIAL_RECEIPT"];

export function purchaseOrderIssueSeverity(revenueAtRisk: number, gapDays = 0) {
  if (gapDays >= 5 || revenueAtRisk >= 100000) return "critical";
  if (gapDays >= 3 || revenueAtRisk >= 50000) return "high";
  if (gapDays >= 1 || revenueAtRisk >= 10000) return "medium";
  return "low";
}

export async function upsertPurchaseOrderIssue(db: any, input: {
  organizationId: string;
  actorId: string;
  type: string;
  skuId: string;
  locationId: string;
  channel: string | null;
  title: string;
  summary: string;
  shortageUnits: number;
  revenueAtRisk: number;
  confidence: number;
  gapDays?: number;
  metadata: Record<string, unknown>;
}) {
  const existing = await db.from("issues").select("*")
    .eq("organization_id", input.organizationId)
    .eq("type", input.type)
    .eq("sku_id", input.skuId)
    .eq("location_id", input.locationId)
    .contains("metadata", { po_line_id: input.metadata.po_line_id })
    .in("status", ACTIVE_PO_ISSUE_STATUSES)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);

  const record = {
    organization_id: input.organizationId,
    type: input.type,
    severity: purchaseOrderIssueSeverity(input.revenueAtRisk, input.gapDays),
    status: existing.data?.status ?? "open",
    sku_id: input.skuId,
    location_id: input.locationId,
    channel: input.channel,
    title: input.title,
    summary: input.summary,
    estimated_shortage_units: Math.max(0, Math.ceil(input.shortageUnits)),
    estimated_revenue_at_risk: input.revenueAtRisk.toFixed(2),
    confidence: Math.min(1, Math.max(0, input.confidence)).toFixed(4),
    metadata: input.metadata,
    resolved_at: null,
  };

  if (existing.data) {
    const updated = await db.from("issues").update(record)
      .eq("organization_id", input.organizationId).eq("id", existing.data.id).select("id").single();
    if (updated.error) throw new Error(updated.error.message);
    return updated.data.id as string;
  }

  const created = await db.from("issues").insert(record).select("id").single();
  if (created.error) throw new Error(created.error.message);
  const audit = await db.from("audit_events").insert({
    organization_id: input.organizationId,
    actor_id: input.actorId,
    entity_type: "issue",
    entity_id: created.data.id,
    event_type: "po_issue_detected",
    before_state: null,
    after_state: record as unknown as Json,
  });
  if (audit.error) throw new Error(audit.error.message);
  return created.data.id as string;
}

export async function resolveStalePurchaseOrderIssues(db: any, organizationId: string, activeKeys: Set<string>) {
  const existing = await db.from("issues").select("id,type,status,metadata")
    .eq("organization_id", organizationId).in("type", PO_ISSUE_TYPES).in("status", ACTIVE_PO_ISSUE_STATUSES);
  if (existing.error) throw new Error(existing.error.message);
  for (const issue of existing.data ?? []) {
    if (issue.status === "running") continue;
    const metadata = issue.metadata as Record<string, unknown>;
    const key = `${issue.type}:${String(metadata.po_line_id ?? "")}`;
    if (activeKeys.has(key)) continue;
    const resolved = await db.from("issues").update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("organization_id", organizationId).eq("id", issue.id);
    if (resolved.error) throw new Error(resolved.error.message);
  }
}
