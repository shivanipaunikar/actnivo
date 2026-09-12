import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

function csv(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function GET() {
  const { organization } = await requireAppContext();
  const supabase = await createClient();
  const { data, error } = await supabase.from("sku_mappings").select("source_sku,status,match_method,confidence,master_sku_id")
    .eq("organization_id", organization.id).order("source_sku");
  if (error) return new Response(error.message, { status: 500 });
  const skuIds = [...new Set((data ?? []).map((row) => row.master_sku_id).filter((id): id is string => Boolean(id)))];
  const { data: skus } = skuIds.length ? await supabase.from("skus").select("id,master_sku").eq("organization_id", organization.id).in("id", skuIds) : { data: [] };
  const skuById = new Map((skus ?? []).map((sku) => [sku.id, sku.master_sku]));
  const lines = ["source_sku,master_sku,status,match_method,confidence", ...(data ?? []).map((row) => [row.source_sku, row.master_sku_id ? skuById.get(row.master_sku_id) : "", row.status, row.match_method, row.confidence ?? ""].map(csv).join(","))];
  return new Response(lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${organization.slug}-sku-mapping.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
