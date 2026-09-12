"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppContext } from "@/lib/auth/session";
import { assertCanManageInventory } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { parseImportFile } from "@/lib/imports/parser";
import type { SkuMapping } from "@/lib/supabase/database.types";

function destination(error?: unknown) {
  return error ? `/app/inventory/sku-mapping?error=${encodeURIComponent(error instanceof Error ? error.message : "Mapping could not be updated.")}` : "/app/inventory/sku-mapping?updated=1";
}

async function mappingForOrganization(mappingId: string, organizationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("sku_mappings").select("*")
    .eq("organization_id", organizationId).eq("id", mappingId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("SKU mapping not found.");
  return { supabase, mapping: data as SkuMapping };
}

export async function approveSuggestion(formData: FormData) {
  const context = await requireAppContext();
  let target = destination();
  try {
    assertCanManageInventory(context.role);
    const mappingId = String(formData.get("mapping_id") ?? "");
    const { supabase, mapping } = await mappingForOrganization(mappingId, context.organization.id);
    if (mapping.status !== "suggested" || !mapping.master_sku_id) throw new Error("This mapping has no suggestion to approve.");
    const { error } = await supabase.from("sku_mappings").update({ status: "mapped" }).eq("organization_id", context.organization.id).eq("id", mapping.id);
    if (error) throw new Error(error.message);
    revalidatePath("/app/inventory/sku-mapping");
  } catch (error) { target = destination(error); }
  redirect(target);
}

export async function manuallyMapSku(formData: FormData) {
  const context = await requireAppContext();
  let target = destination();
  try {
    assertCanManageInventory(context.role);
    const mappingId = String(formData.get("mapping_id") ?? "");
    const masterSkuId = String(formData.get("master_sku_id") ?? "");
    const { supabase, mapping } = await mappingForOrganization(mappingId, context.organization.id);
    const { data: sku, error: skuError } = await supabase.from("skus").select("id")
      .eq("organization_id", context.organization.id).eq("id", masterSkuId).maybeSingle();
    if (skuError) throw new Error(skuError.message);
    if (!sku) throw new Error("Choose a master SKU from this organization.");
    const { error } = await supabase.from("sku_mappings").update({ master_sku_id: masterSkuId, status: "mapped", match_method: "manual", confidence: "1" })
      .eq("organization_id", context.organization.id).eq("id", mapping.id);
    if (error) throw new Error(error.message);
    revalidatePath("/app/inventory/sku-mapping");
  } catch (error) { target = destination(error); }
  redirect(target);
}

async function createMasterForMapping(mapping: SkuMapping, organizationId: string) {
  const supabase = await createClient();
  const { data: existing, error: existingError } = await supabase.from("skus").select("id")
    .eq("organization_id", organizationId).eq("master_sku", mapping.source_sku).maybeSingle();
  if (existingError) throw new Error(existingError.message);
  let skuId = existing?.id;
  if (!skuId) {
    const { data: created, error: createError } = await supabase.from("skus").insert({
      organization_id: organizationId,
      master_sku: mapping.source_sku,
      product_name: mapping.source_product_name || mapping.source_sku,
      barcode: mapping.source_barcode,
      variant: mapping.source_variant,
      pack_size: mapping.source_pack_size,
      mrp: "0",
      selling_price: "0",
    }).select("id").single();
    if (createError) throw new Error(createError.message);
    skuId = created.id;
  }
  const { error } = await supabase.from("sku_mappings").update({ master_sku_id: skuId, status: "mapped", match_method: "new_master", confidence: "1" })
    .eq("organization_id", organizationId).eq("id", mapping.id);
  if (error) throw new Error(error.message);
}

export async function createMasterSku(formData: FormData) {
  const context = await requireAppContext();
  let target = destination();
  try {
    assertCanManageInventory(context.role);
    const { mapping } = await mappingForOrganization(String(formData.get("mapping_id") ?? ""), context.organization.id);
    await createMasterForMapping(mapping, context.organization.id);
    revalidatePath("/app/inventory/sku-mapping");
  } catch (error) { target = destination(error); }
  redirect(target);
}

export async function bulkApproveSuggestions() {
  const context = await requireAppContext();
  let target = destination();
  try {
    assertCanManageInventory(context.role);
    const supabase = await createClient();
    const { error } = await supabase.from("sku_mappings").update({ status: "mapped" })
      .eq("organization_id", context.organization.id).eq("status", "suggested").not("master_sku_id", "is", null);
    if (error) throw new Error(error.message);
    revalidatePath("/app/inventory/sku-mapping");
  } catch (error) { target = destination(error); }
  redirect(target);
}

export async function bulkCreateMasterSkus() {
  const context = await requireAppContext();
  let target = destination();
  try {
    assertCanManageInventory(context.role);
    const supabase = await createClient();
    const { data, error } = await supabase.from("sku_mappings").select("*")
      .eq("organization_id", context.organization.id).in("status", ["unmapped", "conflict"]);
    if (error) throw new Error(error.message);
    for (const mapping of (data ?? []) as SkuMapping[]) await createMasterForMapping(mapping, context.organization.id);
    revalidatePath("/app/inventory/sku-mapping");
  } catch (error) { target = destination(error); }
  redirect(target);
}

export async function importSkuMappingFile(formData: FormData) {
  const context = await requireAppContext();
  let target = destination();
  try {
    assertCanManageInventory(context.role);
    const file = formData.get("file");
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".csv")) throw new Error("Upload a CSV mapping file.");
    const parsed = await parseImportFile(file.name, new Uint8Array(await file.arrayBuffer()));
    const headerMap = new Map(parsed.headers.map((header) => [header.toLowerCase().trim(), header]));
    const sourceHeader = headerMap.get("source_sku");
    const masterHeader = headerMap.get("master_sku");
    if (!sourceHeader || !masterHeader) throw new Error("CSV must contain source_sku and master_sku headers.");
    const supabase = await createClient();
    for (const row of parsed.rows) {
      const sourceSku = String(row[sourceHeader] ?? "").trim();
      const masterSku = String(row[masterHeader] ?? "").trim();
      if (!sourceSku || !masterSku) continue;
      const { data: sku } = await supabase.from("skus").select("id").eq("organization_id", context.organization.id).eq("master_sku", masterSku).maybeSingle();
      if (!sku) throw new Error(`Master SKU ${masterSku} does not exist.`);
      const { error } = await supabase.from("sku_mappings").update({ master_sku_id: sku.id, status: "mapped", match_method: "manual", confidence: "1" })
        .eq("organization_id", context.organization.id).eq("source_sku", sourceSku);
      if (error) throw new Error(error.message);
    }
    revalidatePath("/app/inventory/sku-mapping");
  } catch (error) { target = destination(error); }
  redirect(target);
}
