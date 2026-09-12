import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

function csvCell(value: unknown) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { organization }] = await Promise.all([params, requireAppContext()]);
  const supabase = await createClient();
  const result = await supabase.from("actions").select("*").eq("organization_id", organization.id).eq("id", id).maybeSingle();
  if (result.error || !result.data) return new Response("Action not found", { status: 404 });
  const payload = result.data.payload as Record<string, unknown>;
  const headers = ["Action ID", "Master SKU", "Product", "Source Location", "Destination Location", "Quantity", "Execution Mode"];
  const row = [result.data.id, payload.master_sku, payload.product_name, payload.source_location, payload.destination_location, payload.quantity, result.data.execution_mode];
  return new Response(`${headers.map(csvCell).join(",")}\n${row.map(csvCell).join(",")}\n`, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="actnivo-transfer-${id.slice(0, 8)}.csv"`, "cache-control": "private, no-store" } });
}
