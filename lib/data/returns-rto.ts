import type { SupabaseClient } from "@supabase/supabase-js";
import { detectReturnException } from "@/lib/returns-rto/intelligence";

export async function getReturnsRtoWorkspace(supabase: SupabaseClient<any>, organizationId: string) {
  const db = supabase as any;
  const [returnsResult, linesResult, ordersResult, skusResult] = await Promise.all([
    db.from("returns_rto").select("*").eq("organization_id", organizationId).order("requested_at", { ascending: false }),
    db.from("return_rto_lines").select("*").eq("organization_id", organizationId),
    db.from("orders").select("id,external_order_id,channel,payment_method,customer_city").eq("organization_id", organizationId),
    db.from("skus").select("id,master_sku,product_name").eq("organization_id", organizationId),
  ]);
  for (const result of [returnsResult, linesResult, ordersResult, skusResult]) if (result.error) throw new Error(result.error.message);
  const orderMap = new Map((ordersResult.data ?? []).map((row: any) => [row.id, row]));
  const skuMap = new Map((skusResult.data ?? []).map((row: any) => [row.id, row]));
  const linesByReturn = new Map<string, any[]>();
  for (const line of linesResult.data ?? []) { const list = linesByReturn.get(line.return_id) ?? []; list.push({ ...line, sku: skuMap.get(line.sku_id) }); linesByReturn.set(line.return_id, list); }
  const rows = (returnsResult.data ?? []).map((row: any) => ({ ...row, order: orderMap.get(row.order_id) ?? null, lines: linesByReturn.get(row.id) ?? [], exception: detectReturnException(row) }));
  const active = rows.filter((row: any) => !["REFUNDED", "CLOSED", "CANCELLED"].includes(row.status));
  const exceptions = rows.filter((row: any) => row.exception);
  const cashTiedUp = active.reduce((sum: number, row: any) => sum + Number(row.refund_amount ?? 0), 0);
  const reverseCost = rows.reduce((sum: number, row: any) => sum + Number(row.reverse_logistics_cost ?? 0), 0);
  const rtoRows = rows.filter((row: any) => row.kind === "RTO");
  const returnRows = rows.filter((row: any) => row.kind === "RETURN");
  const lossBySku = new Map<string, { sku: string; product: string; count: number; value: number }>();
  for (const row of rows) for (const line of row.lines) { const key = line.sku?.master_sku ?? line.sku_id; const current = lossBySku.get(key) ?? { sku: line.sku?.master_sku ?? "Unknown", product: line.sku?.product_name ?? "Unknown", count: 0, value: 0 }; current.count += 1; current.value += Number(line.quantity) * Number(line.unit_value) + Number(row.reverse_logistics_cost ?? 0) / Math.max(1, row.lines.length); lossBySku.set(key, current); }
  const topLossSkus = [...lossBySku.values()].sort((a, b) => b.value - a.value).slice(0, 5);
  const channelCounts = new Map<string, { total: number; rto: number; value: number }>();
  for (const row of rows) { const channel = String(row.order?.channel ?? "other"); const current = channelCounts.get(channel) ?? { total: 0, rto: 0, value: 0 }; current.total += 1; if (row.kind === "RTO") current.rto += 1; current.value += Number(row.refund_amount ?? 0) + Number(row.reverse_logistics_cost ?? 0); channelCounts.set(channel, current); }
  const channelPatterns = [...channelCounts.entries()].map(([channel, values]) => ({ channel, ...values, rtoRate: values.total ? values.rto / values.total : 0 })).sort((a, b) => b.rtoRate - a.rtoRate);
  return { rows, exceptions, topLossSkus, channelPatterns, summary: { total: rows.length, active: active.length, returns: returnRows.length, rto: rtoRows.length, cashTiedUp, reverseCost, exceptions: exceptions.length } };
}

export async function getReturnRtoDetail(supabase: SupabaseClient<any>, organizationId: string, id: string) {
  const workspace = await getReturnsRtoWorkspace(supabase, organizationId);
  return workspace.rows.find((row: any) => row.id === id) ?? null;
}
