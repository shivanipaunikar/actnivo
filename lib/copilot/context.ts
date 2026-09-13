import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getInventoryData } from "@/lib/data/inventory";
import { getOpsInbox, getActions, getValueMetrics } from "@/lib/data/operations";
import { getQuickCommerceCommandCenter } from "@/lib/data/quick-commerce";
import { getPurchaseOrderWorkspace } from "@/lib/data/purchase-orders";

const activeIssue = (status: string) => !["resolved", "ignored"].includes(status);

export type CopilotContext = Awaited<ReturnType<typeof buildCopilotContext>>;

export async function buildCopilotContext(
  supabase: SupabaseClient<Database>,
  organizationId: string,
) {
  const [inventory, ops, actions, value, quickCommerce, purchaseOrders] = await Promise.all([
    getInventoryData(supabase, organizationId),
    getOpsInbox(supabase, organizationId),
    getActions(supabase, organizationId),
    getValueMetrics(supabase, organizationId),
    getQuickCommerceCommandCenter(supabase, organizationId),
    getPurchaseOrderWorkspace(supabase as any, organizationId),
  ]);

  const topRisks = ops
    .filter((item) => activeIssue(item.issue.status))
    .sort((a, b) => Number(b.issue.estimated_revenue_at_risk ?? 0) - Number(a.issue.estimated_revenue_at_risk ?? 0))
    .slice(0, 12)
    .map((item) => ({
      id: item.issue.id,
      type: item.issue.type,
      severity: item.issue.severity,
      status: item.issue.status,
      title: item.issue.title,
      summary: item.issue.summary,
      sku: item.sku?.master_sku ?? null,
      product: item.sku?.product_name ?? null,
      location: item.location?.name ?? null,
      channel: item.issue.channel,
      daysOfCover: item.issue.days_of_cover === null ? null : Number(item.issue.days_of_cover),
      shortageUnits: item.issue.estimated_shortage_units,
      revenueAtRisk: Number(item.issue.estimated_revenue_at_risk ?? 0),
      confidence: item.issue.confidence === null ? null : Number(item.issue.confidence),
      recommendation: item.recommendation ? {
        quantity: item.recommendation.quantity,
        sourceLocation: item.sourceLocation?.name ?? null,
        destinationLocation: item.location?.name ?? null,
        revenueProtected: Number(item.recommendation.estimated_revenue_protected),
        reason: item.recommendation.reason,
      } : null,
      href: `/app/ops/issues/${item.issue.id}`,
    }));

  const inventoryPosition = inventory.summaries
    .slice()
    .sort((a, b) => (a.daysOfCover ?? Number.POSITIVE_INFINITY) - (b.daysOfCover ?? Number.POSITIVE_INFINITY))
    .slice(0, 15)
    .map((item) => ({
      sku: item.sku.master_sku,
      product: item.sku.product_name,
      available: item.available,
      reserved: item.reserved,
      inbound: item.inbound,
      sevenDaySales: item.sevenDaySales,
      daysOfCover: item.daysOfCover,
      status: item.status,
      locations: item.locations.map((location) => location.name),
      channels: item.channels,
      href: `/app/inventory/${item.sku.id}`,
    }));

  const poRisks = purchaseOrders.risks.slice(0, 12).map((risk) => ({
    poId: risk.poId,
    poNumber: risk.poNumber,
    poLineId: risk.poLineId,
    sku: risk.masterSku,
    product: risk.productName,
    supplier: risk.supplierName,
    destination: risk.destinationLocationName,
    expectedArrivalDate: risk.expectedArrivalDate,
    projectedStockoutAt: risk.projectedStockoutAt,
    gapDays: risk.gapDays,
    remainingInboundQuantity: risk.remainingInboundQuantity,
    revenueAtRisk: risk.revenueAtRisk,
    recommendationType: risk.recommendationType,
    transfer: risk.transferRecommendation ?? null,
    href: `/app/purchase-orders/${risk.poId}`,
  }));

  const channelHealth = quickCommerce.channelHealth.map((channel) => ({
    channel: channel.channel,
    connected: channel.connected,
    health: channel.health,
    activeSkus: channel.activeSkus,
    lowStockSkus: channel.lowStockSkus,
    stockoutRiskSkus: channel.stockoutRiskSkus,
    revenueAtRisk: channel.revenueAtRisk,
    sevenDaySales: channel.recentSales,
    inventoryInStockPercent: channel.inventoryInStockPercent,
    availabilityConnected: channel.availabilityConnected,
  }));

  const pendingActions = actions
    .filter((item) => !["VERIFIED", "FAILED", "CANCELLED"].includes(item.action.status))
    .slice(0, 12)
    .map((item) => ({
      id: item.action.id,
      type: item.action.type,
      status: item.action.status,
      executionMode: item.action.execution_mode,
      issueId: item.action.issue_id,
      estimatedValueProtected: Number(item.outcome?.estimated_value_protected ?? 0),
      href: `/app/actions/${item.action.id}`,
    }));

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      activeIssues: ops.filter((item) => activeIssue(item.issue.status)).length,
      revenueAtRisk: value.revenueAtRisk,
      estimatedRevenueProtected: value.estimatedRevenueProtected,
      actualRevenueProtected: value.actualRevenueProtected,
      actionsApproved: value.actionsApproved,
      actionsVerified: value.actionsVerified,
      lowStockSkus: inventory.summaries.filter((item) => item.status === "Low stock").length,
      inventorySkus: inventory.summaries.length,
      openPurchaseOrders: purchaseOrders.purchaseOrders.filter((po: any) => !["RECEIVED", "CANCELLED"].includes(po.status)).length,
      poRiskLines: purchaseOrders.risks.length,
      quickCommerceRevenueAtRisk: quickCommerce.summary.revenueAtRisk,
    },
    topRisks,
    inventoryPosition,
    purchaseOrderRisks: poRisks,
    quickCommerce: {
      summary: quickCommerce.summary,
      channelHealth,
    },
    pendingActions,
    valueGenerated: value,
  };
}
