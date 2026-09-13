import type { SupabaseClient } from "@supabase/supabase-js";
import { detectOrderException } from "@/lib/orders/intelligence";

export async function getOrdersWorkspace(supabase: SupabaseClient<any>, organizationId: string) {
  const db = supabase as any;
  const [ordersResult, linesResult, skusResult, locationsResult] = await Promise.all([
    db.from("orders").select("*").eq("organization_id", organizationId).order("order_placed_at", { ascending: false }),
    db.from("order_lines").select("*").eq("organization_id", organizationId),
    db.from("skus").select("id,master_sku,product_name").eq("organization_id", organizationId),
    db.from("locations").select("id,name,city").eq("organization_id", organizationId),
  ]);
  for (const result of [ordersResult, linesResult, skusResult, locationsResult]) if (result.error) throw new Error(result.error.message);

  const lines = linesResult.data ?? [];
  const skuById = new Map((skusResult.data ?? []).map((row: any) => [row.id, row]));
  const locationById = new Map((locationsResult.data ?? []).map((row: any) => [row.id, row]));
  const orders = (ordersResult.data ?? []).map((order: any) => {
    const orderLines = lines.filter((line: any) => line.order_id === order.id);
    return {
      ...order,
      lines: orderLines.map((line: any) => ({ ...line, sku: skuById.get(line.sku_id) ?? null })),
      location: order.location_id ? locationById.get(order.location_id) ?? null : null,
      exception: detectOrderException(order),
      units: orderLines.reduce((sum: number, line: any) => sum + Number(line.quantity), 0),
    };
  });

  const exceptions = orders.filter((order: any) => order.exception).sort((a: any, b: any) => b.exception.revenueAtRisk - a.exception.revenueAtRisk);
  const openOrders = orders.filter((order: any) => !["DELIVERED", "CANCELLED", "RETURNED", "RTO"].includes(order.status));
  return {
    orders,
    exceptions,
    summary: {
      totalOrders: orders.length,
      openOrders: openOrders.length,
      delayedOrders: exceptions.filter((order: any) => order.exception.type === "ORDER_DELAYED").length,
      stuckOrders: exceptions.filter((order: any) => order.exception.type === "ORDER_STUCK").length,
      rtoRiskOrders: exceptions.filter((order: any) => order.exception.type === "RTO_RISK").length,
      revenueAtRisk: exceptions.reduce((sum: number, order: any) => sum + Number(order.exception.revenueAtRisk), 0),
      openOrderValue: openOrders.reduce((sum: number, order: any) => sum + Number(order.order_value ?? 0), 0),
    },
  };
}

export async function getOrderDetail(supabase: SupabaseClient<any>, organizationId: string, orderId: string) {
  const workspace = await getOrdersWorkspace(supabase, organizationId);
  return workspace.orders.find((order: any) => order.id === orderId) ?? null;
}
