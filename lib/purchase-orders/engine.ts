import type { SupabaseClient } from "@supabase/supabase-js";
import { getPurchaseOrderWorkspace } from "@/lib/data/purchase-orders";
import { resolveStalePurchaseOrderIssues, upsertPurchaseOrderIssue } from "./issues";
import { verifyExpediteActions } from "./verification";

export async function runPurchaseOrderIntelligence(supabase: SupabaseClient<any>, organizationId: string, actorId: string) {
  const db = supabase as any;
  const today = new Date().toISOString().slice(0, 10);
  const markLate = await db.from("purchase_orders").update({ status: "LATE" })
    .eq("organization_id", organizationId).in("status", ["OPEN", "ACKNOWLEDGED"]).lt("expected_delivery_date", today);
  if (markLate.error) throw new Error(markLate.error.message);
  await verifyExpediteActions(db, organizationId, actorId);
  const workspace = await getPurchaseOrderWorkspace(supabase, organizationId);
  const activeKeys = new Set<string>();
  let issueCount = 0;
  let recommendationCount = 0;

  for (const risk of workspace.risks) {
    const po = workspace.purchaseOrders.find((item: any) => item.id === risk.poId) as any;
    const line = workspace.lines.find((item: any) => item.id === risk.poLineId) as any;
    activeKeys.add(`PO_ARRIVES_AFTER_STOCKOUT:${risk.poLineId}`);
    const sellingPrice = risk.unitsAtRisk ? risk.revenueAtRisk / risk.unitsAtRisk : 0;
    const issueId = await upsertPurchaseOrderIssue(db, {
      organizationId, actorId, type: "PO_ARRIVES_AFTER_STOCKOUT", skuId: risk.skuId,
      locationId: risk.destinationLocationId, channel: po?.channel ?? null,
      title: `${risk.productName} inbound arrives after projected stockout`,
      summary: `PO ${risk.poNumber} from ${risk.supplierName} is expected ${risk.gapDays} day${risk.gapDays === 1 ? "" : "s"} after projected stockout.`,
      shortageUnits: risk.unitsAtRisk, revenueAtRisk: risk.revenueAtRisk, confidence: risk.confidence, gapDays: risk.gapDays,
      metadata: {
        purchase_order_id: risk.poId, po_line_id: risk.poLineId, po_number: risk.poNumber,
        supplier_name: risk.supplierName, expected_arrival_date: risk.expectedArrivalDate,
        projected_stockout_at: risk.projectedStockoutAt, gap_days: risk.gapDays,
        recommendation_type: risk.recommendationType, selling_price: sellingPrice,
        ordered_quantity: line?.ordered_quantity ?? null, confirmed_quantity: line?.confirmed_quantity ?? null,
        received_quantity: line?.received_quantity ?? null,
      },
    });
    issueCount += 1;

    if (risk.transfer) {
      const saved = await db.from("issue_recommendations").upsert({
        organization_id: organizationId, issue_id: issueId, source_location_id: risk.transfer.sourceLocationId,
        destination_location_id: risk.destinationLocationId, quantity: risk.transfer.quantity,
        reason: `Bridge the inbound gap before PO ${risk.poNumber} arrives.`,
        estimated_revenue_protected: risk.transfer.estimatedRevenueProtected.toFixed(2),
        source_coverage_after: risk.transfer.sourceCoverageAfter.toFixed(4),
        destination_coverage_after: risk.transfer.destinationCoverageAfter.toFixed(4),
        calculation: { formula_version: "po-bridge-v1", po_line_id: risk.poLineId, gap_days: risk.gapDays, selling_price: sellingPrice },
      }, { onConflict: "issue_id" });
      if (saved.error) throw new Error(saved.error.message);
      recommendationCount += 1;
    }
    const status = await db.from("issues").update({ status: "needs_approval" })
      .eq("organization_id", organizationId).eq("id", issueId).eq("status", "open");
    if (status.error) throw new Error(status.error.message);
  }

  for (const po of workspace.purchaseOrders as any[]) {
    if (["RECEIVED", "CANCELLED"].includes(po.status)) continue;
    const poLines = workspace.lines.filter((line: any) => line.purchase_order_id === po.id);
    for (const line of poLines as any[]) {
      const sku = workspace.skuById.get(line.sku_id) as any;
      if (!sku) continue;
      const sellingPrice = Number(sku.selling_price ?? 0);
      const confirmed = Number(line.confirmed_quantity ?? line.ordered_quantity);
      const received = Number(line.received_quantity ?? 0);
      const remaining = Math.max(0, confirmed - received);
      const common = { organizationId, actorId, skuId: line.sku_id, locationId: po.destination_location_id, channel: po.channel ?? null, confidence: 1 };
      const metadata = { purchase_order_id: po.id, po_line_id: line.id, po_number: po.external_po_number, supplier_name: po.supplier_name, selling_price: sellingPrice, recommendation_type: "EXPEDITE_PO" };

      if (confirmed < Number(line.ordered_quantity)) {
        const shortage = Number(line.ordered_quantity) - confirmed;
        activeKeys.add(`PO_SHORTAGE:${line.id}`);
        await upsertPurchaseOrderIssue(db, { ...common, type: "PO_SHORTAGE", title: `${sku.product_name} PO quantity is short`, summary: `PO ${po.external_po_number} confirmed ${confirmed} of ${line.ordered_quantity} ordered units.`, shortageUnits: shortage, revenueAtRisk: shortage * sellingPrice, metadata });
        issueCount += 1;
      }
      if (received > 0 && remaining > 0) {
        activeKeys.add(`PO_PARTIAL_RECEIPT:${line.id}`);
        await upsertPurchaseOrderIssue(db, { ...common, type: "PO_PARTIAL_RECEIPT", title: `${sku.product_name} PO is only partially received`, summary: `PO ${po.external_po_number} has ${received} received units and ${remaining} units still outstanding.`, shortageUnits: remaining, revenueAtRisk: remaining * sellingPrice, metadata });
        issueCount += 1;
      }
      const stockoutRisk = workspace.risks.find((risk) => risk.poLineId === line.id);
      if (po.status === "LATE" && !stockoutRisk) {
        activeKeys.add(`PO_LATE:${line.id}`);
        await upsertPurchaseOrderIssue(db, { ...common, type: "PO_LATE", title: `${sku.product_name} PO is late`, summary: `PO ${po.external_po_number} passed its expected delivery date with ${remaining} units still inbound.`, shortageUnits: remaining, revenueAtRisk: remaining * sellingPrice, metadata: { ...metadata, expected_arrival_date: po.expected_delivery_date } });
        issueCount += 1;
      }
    }
  }

  await resolveStalePurchaseOrderIssues(db, organizationId, activeKeys);
  return { assessedLines: workspace.lines.length, risks: workspace.risks.length, issues: issueCount, recommendations: recommendationCount };
}
