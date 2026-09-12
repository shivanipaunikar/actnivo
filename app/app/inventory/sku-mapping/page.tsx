import Link from "next/link";
import { requireAppContext } from "@/lib/auth/session";
import { canManageInventory } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { Sku, SkuMapping, SkuMappingStatus } from "@/lib/supabase/database.types";
import { StatusBadge } from "@/components/app/StatusBadge";
import { approveSuggestion, bulkApproveSuggestions, bulkCreateMasterSkus, createMasterSku, importSkuMappingFile, manuallyMapSku } from "./actions";

const statuses: Array<{ value: SkuMappingStatus | "all"; label: string }> = [
  { value: "all", label: "All" }, { value: "mapped", label: "Mapped" }, { value: "suggested", label: "Suggested" },
  { value: "conflict", label: "Conflict" }, { value: "unmapped", label: "Unmapped" },
];

export default async function SkuMappingPage({ searchParams }: { searchParams: Promise<{ status?: string; job?: string; error?: string; updated?: string }> }) {
  const query = await searchParams;
  const context = await requireAppContext();
  const supabase = await createClient();
  let allowedMappingIds: string[] | null = null;
  if (query.job) {
    const { data } = await supabase.from("import_rows").select("sku_mapping_id")
      .eq("organization_id", context.organization.id).eq("import_job_id", query.job).not("sku_mapping_id", "is", null);
    allowedMappingIds = [...new Set((data ?? []).map((row) => row.sku_mapping_id!).filter(Boolean))];
  }
  let mappingQuery = supabase.from("sku_mappings").select("*").eq("organization_id", context.organization.id).order("created_at", { ascending: false });
  if (query.status && query.status !== "all" && statuses.some((item) => item.value === query.status)) mappingQuery = mappingQuery.eq("status", query.status as SkuMappingStatus);
  if (allowedMappingIds) mappingQuery = allowedMappingIds.length ? mappingQuery.in("id", allowedMappingIds) : mappingQuery.eq("id", "00000000-0000-0000-0000-000000000000");
  const [{ data: mappingsData, error: mappingsError }, { data: skusData, error: skusError }] = await Promise.all([
    mappingQuery,
    supabase.from("skus").select("*").eq("organization_id", context.organization.id).eq("active", true).order("product_name"),
  ]);
  if (mappingsError) throw new Error(mappingsError.message);
  if (skusError) throw new Error(skusError.message);
  const mappings = (mappingsData ?? []) as SkuMapping[];
  const skus = (skusData ?? []) as Sku[];
  const skuById = new Map(skus.map((sku) => [sku.id, sku]));
  const counts = Object.fromEntries(statuses.slice(1).map(({ value }) => [value, mappings.filter((mapping) => mapping.status === value).length]));
  const manageable = canManageInventory(context.role);
  return (
    <div className="product-page sku-mapping-page">
      <header className="product-page-header"><div><p>INVENTORY / NORMALIZATION</p><h1>SKU mapping</h1><span>Resolve source identifiers into one master catalog without AI-generated decisions.</span></div><div className="header-actions"><Link href="/app/inventory/sku-mapping/export">Export CSV</Link>{query.job && <Link className="saas-primary" href={`/app/integrations/import/${query.job}`}>Return to import</Link>}</div></header>
      {query.error && <p className="product-alert error">{query.error}</p>}{query.updated && <p className="product-alert success">SKU mappings updated.</p>}
      <div className="mapping-summary">{statuses.slice(1).map(({ value, label }) => <article key={value}><small>{label}</small><strong>{counts[value] ?? 0}</strong></article>)}</div>
      <section className="mapping-toolbar"><nav>{statuses.map(({ value, label }) => <Link key={value} className={(query.status ?? "all") === value ? "active" : ""} href={`/app/inventory/sku-mapping?status=${value}${query.job ? `&job=${query.job}` : ""}`}>{label}</Link>)}</nav><div><form action={bulkApproveSuggestions}><button type="submit" disabled={!manageable}>Bulk approve suggestions</button></form><form action={bulkCreateMasterSkus}><button type="submit" disabled={!manageable}>Create masters for unmapped</button></form></div></section>
      <section className="product-card mapping-list"><header><div><small>MATCHING ORDER</small><h2>Barcode → exact SKU → normalized SKU → product similarity</h2></div><span>{mappings.length} records</span></header>{mappings.length ? mappings.map((mapping) => { const matched = mapping.master_sku_id ? skuById.get(mapping.master_sku_id) : null; return <article key={mapping.id}><div className="mapping-source"><small>SOURCE SKU</small><strong>{mapping.source_sku}</strong><span>{mapping.source_product_name || "No product name"}{mapping.source_variant ? ` · ${mapping.source_variant}` : ""}</span></div><div className="mapping-arrow">→</div><div className="mapping-target"><small>MASTER SKU</small><strong>{matched?.master_sku ?? "Decision required"}</strong><span>{matched?.product_name ?? `${mapping.match_method.replaceAll("_", " ")}${mapping.confidence ? ` · ${Math.round(Number(mapping.confidence) * 100)}%` : ""}`}</span></div><StatusBadge status={mapping.status} /><div className="mapping-actions">{mapping.status === "suggested" && <form action={approveSuggestion}><input type="hidden" name="mapping_id" value={mapping.id} /><button type="submit" disabled={!manageable}>Approve</button></form>}<form action={manuallyMapSku}><input type="hidden" name="mapping_id" value={mapping.id} /><select name="master_sku_id" defaultValue={mapping.master_sku_id ?? ""} required disabled={!manageable}><option value="">Choose master SKU</option>{skus.map((sku) => <option key={sku.id} value={sku.id}>{sku.master_sku} — {sku.product_name}</option>)}</select><button type="submit" disabled={!manageable}>Map</button></form>{mapping.status !== "mapped" && <form action={createMasterSku}><input type="hidden" name="mapping_id" value={mapping.id} /><button type="submit" disabled={!manageable}>Create new master</button></form>}</div></article>; }) : <div className="product-empty"><span>◇</span><h3>No SKU mappings yet.</h3><p>Upload inventory or sales data to create source SKU records.</p><Link className="saas-primary" href="/app/integrations/import">Upload data</Link></div>}</section>
      <section className="bulk-mapping"><div><small>BULK MAP</small><h2>Import mapping decisions</h2><p>Upload a CSV containing <b>source_sku</b> and <b>master_sku</b>. Both identifiers must already exist in this workspace.</p></div><form action={importSkuMappingFile}><input type="file" name="file" accept=".csv,text/csv" required disabled={!manageable} /><button type="submit" disabled={!manageable}>Import mapping CSV</button></form></section>
    </div>
  );
}
