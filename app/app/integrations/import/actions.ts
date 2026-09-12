"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppContext } from "@/lib/auth/session";
import { assertCanManageInventory } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { Database, ImportJob, Json, Sku, SkuMapping } from "@/lib/supabase/database.types";
import { getAllImportRows, getImportJob } from "@/lib/data/imports";
import { parseImportFile, safeFilename, sha256 } from "@/lib/imports/parser";
import { matchSku } from "@/lib/imports/matching";
import { processImportJob } from "@/lib/imports/process";
import { runOperatingLoop } from "@/lib/operations/engine";
import { importDefinitions, validateRows } from "@/lib/imports/validation";
import type { ColumnMapping, RawImportRow } from "@/lib/imports/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const BATCH_SIZE = 400;

function message(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function errorPath(path: string, error: unknown) {
  return `${path}?error=${encodeURIComponent(message(error))}`;
}

async function getAllSkus(supabase: SupabaseClient<Database>, organizationId: string) {
  const skus: Sku[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("skus").select("*").eq("organization_id", organizationId).range(from, from + 999);
    if (error) throw new Error(error.message);
    skus.push(...((data ?? []) as Sku[]));
    if ((data?.length ?? 0) < 1000) break;
  }
  return skus;
}

async function getMappings(supabase: SupabaseClient<Database>, organizationId: string, sourceType: ImportJob["source_type"]) {
  const mappings: SkuMapping[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("sku_mappings").select("*")
      .eq("organization_id", organizationId).eq("source_type", sourceType).range(from, from + 999);
    if (error) throw new Error(error.message);
    mappings.push(...((data ?? []) as SkuMapping[]));
    if ((data?.length ?? 0) < 1000) break;
  }
  return mappings;
}

export async function uploadImport(formData: FormData) {
  const context = await requireAppContext();
  let target = "/app/integrations/import";
  let jobId: string | null = null;
  let supabase: SupabaseClient<Database> | null = null;
  try {
    assertCanManageInventory(context.role);
    const sourceType = String(formData.get("source_type") ?? "");
    if (sourceType !== "inventory" && sourceType !== "sales") throw new Error("Choose inventory or sales data.");
    const file = formData.get("file");
    if (!(file instanceof File) || !file.name) throw new Error("Choose a CSV or XLSX file.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const parsed = await parseImportFile(file.name, bytes);
    const checksum = sha256(bytes);
    supabase = await createClient();
    const { data: duplicate } = await supabase.from("source_files").select("import_job_id")
      .eq("organization_id", context.organization.id).eq("checksum", checksum).maybeSingle();
    if (duplicate) throw new Error("This exact file has already been uploaded.");

    jobId = crypto.randomUUID();
    const storagePath = `${context.organization.id}/imports/${jobId}/${safeFilename(file.name)}`;
    const mimeType = file.name.toLowerCase().endsWith(".csv")
      ? "text/csv"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const { error: jobError } = await supabase.from("import_jobs").insert({
      id: jobId,
      organization_id: context.organization.id,
      source_type: sourceType,
      filename: file.name,
      storage_path: storagePath,
      status: "uploaded",
      total_rows: parsed.rows.length,
      created_by: context.user.id,
    });
    if (jobError) throw new Error(jobError.message);

    const { error: uploadError } = await supabase.storage.from("commerce-imports").upload(storagePath, bytes, {
      contentType: mimeType,
      upsert: false,
    });
    if (uploadError) {
      await supabase.from("import_jobs").update({ status: "failed", error_summary: uploadError.message })
        .eq("organization_id", context.organization.id).eq("id", jobId);
      throw new Error(uploadError.message);
    }

    const { error: sourceError } = await supabase.from("source_files").insert({
      organization_id: context.organization.id,
      import_job_id: jobId,
      storage_path: storagePath,
      original_filename: file.name,
      mime_type: mimeType,
      file_size: bytes.byteLength,
      checksum,
    });
    if (sourceError) throw new Error(sourceError.message);

    for (let index = 0; index < parsed.rows.length; index += BATCH_SIZE) {
      const batch = parsed.rows.slice(index, index + BATCH_SIZE).map((raw, offset) => ({
        organization_id: context.organization.id,
        import_job_id: jobId!,
        row_number: index + offset + 2,
        raw_data: raw as Json,
        row_hash: sha256(JSON.stringify(raw)),
        status: "staged" as const,
      }));
      const { error } = await supabase.from("import_rows").insert(batch);
      if (error) throw new Error(error.message);
    }
    const { error: updateError } = await supabase.from("import_jobs").update({
      status: "mapping_required",
      error_summary: null,
    }).eq("organization_id", context.organization.id).eq("id", jobId);
    if (updateError) throw new Error(updateError.message);
    target = `/app/integrations/import/${jobId}`;
  } catch (error) {
    if (supabase && jobId) {
      await supabase.from("import_jobs").update({
        status: "failed",
        error_summary: message(error),
        completed_at: new Date().toISOString(),
      }).eq("organization_id", context.organization.id).eq("id", jobId);
    }
    target = errorPath("/app/integrations/import", error);
  }
  redirect(target);
}

export async function mapImportColumns(formData: FormData) {
  const context = await requireAppContext();
  const jobId = String(formData.get("job_id") ?? "");
  const path = `/app/integrations/import/${jobId}`;
  let target = path;
  try {
    assertCanManageInventory(context.role);
    const supabase = await createClient();
    const job = await getImportJob(supabase, context.organization.id, jobId);
    if (!job) throw new Error("Import job not found.");
    if (job.status === "completed") throw new Error("Completed imports cannot be remapped.");
    const mapping: ColumnMapping = {};
    for (const field of importDefinitions[job.source_type].fields) {
      const header = String(formData.get(`map_${field.key}`) ?? "").trim();
      if (header) mapping[field.key] = header;
    }
    const dbRows = await getAllImportRows(supabase, context.organization.id, job.id);
    const rawRows = dbRows.map((row) => row.raw_data as RawImportRow);
    const validated = validateRows(job.source_type, rawRows, mapping);
    const candidates = await getAllSkus(supabase, context.organization.id);
    const existingMappings = await getMappings(supabase, context.organization.id, job.source_type);
    const mappingBySource = new Map(existingMappings.map((item) => [item.source_sku, item]));
    const newMappings: SkuMapping[] = [];

    for (const row of validated) {
      const normalized = row.normalized;
      if (!normalized || row.duplicate || mappingBySource.has(normalized.sku)) continue;
      const match = matchSku({
        sku: normalized.sku,
        barcode: normalized.barcode,
        productName: normalized.product_name,
        variant: normalized.variant,
        packSize: normalized.pack_size,
      }, candidates);
      const record: SkuMapping = {
        id: crypto.randomUUID(),
        organization_id: context.organization.id,
        source_type: job.source_type,
        source_sku: normalized.sku,
        source_barcode: normalized.barcode,
        source_product_name: normalized.product_name,
        source_variant: normalized.variant,
        source_pack_size: normalized.pack_size,
        master_sku_id: match.skuId,
        status: match.status,
        match_method: match.method,
        confidence: match.confidence === null ? null : String(match.confidence),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      newMappings.push(record);
      mappingBySource.set(record.source_sku, record);
    }
    for (let index = 0; index < newMappings.length; index += BATCH_SIZE) {
      const { error } = await supabase.from("sku_mappings").insert(newMappings.slice(index, index + BATCH_SIZE));
      if (error) throw new Error(error.message);
    }

    const rowRecords = validated.map((validatedRow, index) => {
      const original = dbRows[index];
      const skuMapping = validatedRow.normalized ? mappingBySource.get(validatedRow.normalized.sku) : null;
      const invalid = validatedRow.errors.length > 0;
      const ready = skuMapping?.status === "mapped";
      return {
        id: original.id,
        organization_id: context.organization.id,
        import_job_id: job.id,
        row_number: original.row_number,
        raw_data: original.raw_data,
        normalized_data: validatedRow.normalized as unknown as Json | null,
        validation_errors: validatedRow.errors,
        row_hash: validatedRow.rowHash,
        status: validatedRow.duplicate ? "duplicate" as const : invalid ? "invalid" as const : ready ? "valid" as const : "pending_sku_mapping" as const,
        sku_mapping_id: skuMapping?.id ?? null,
      };
    });
    for (let index = 0; index < rowRecords.length; index += BATCH_SIZE) {
      const { error } = await supabase.from("import_rows").upsert(rowRecords.slice(index, index + BATCH_SIZE), { onConflict: "id" });
      if (error) throw new Error(error.message);
    }

    const validRows = validated.filter((row) => row.normalized && !row.duplicate).length;
    const duplicateRows = validated.filter((row) => row.duplicate).length;
    const invalidRows = validated.filter((row) => !row.duplicate && row.errors.length).length;
    const mappingRequired = rowRecords.some((row) => row.status === "pending_sku_mapping");
    const { error: updateError } = await supabase.from("import_jobs").update({
      status: mappingRequired ? "mapping_required" : "processing",
      successful_rows: validRows,
      failed_rows: invalidRows + duplicateRows,
      error_summary: invalidRows || duplicateRows ? `${invalidRows} invalid · ${duplicateRows} duplicate` : null,
      column_mapping: mapping as Json,
    }).eq("organization_id", context.organization.id).eq("id", job.id);
    if (updateError) throw new Error(updateError.message);
    revalidatePath(path);
    target = `${path}?validated=1`;
  } catch (error) {
    target = errorPath(path, error);
  }
  redirect(target);
}

export async function completeImport(formData: FormData) {
  const context = await requireAppContext();
  const jobId = String(formData.get("job_id") ?? "");
  const path = `/app/integrations/import/${jobId}`;
  let target = path;
  try {
    assertCanManageInventory(context.role);
    const supabase = await createClient();
    const job = await getImportJob(supabase, context.organization.id, jobId);
    if (!job) throw new Error("Import job not found.");
    if (job.status !== "completed") {
      await supabase.from("import_jobs").update({ status: "processing" }).eq("organization_id", context.organization.id).eq("id", job.id);
      await processImportJob(supabase, context.organization, job);
      try {
        await runOperatingLoop(supabase, context.organization, context.user.id);
      } catch (scanError) {
        await supabase.from("import_jobs").update({
          error_summary: `Data imported. Operations scan needs retry: ${message(scanError)}`,
        }).eq("organization_id", context.organization.id).eq("id", job.id);
      }
      revalidatePath("/app/inventory");
      revalidatePath("/app/ops");
      revalidatePath("/app/value");
      revalidatePath(path);
    }
    target = `${path}?completed=1`;
  } catch (error) {
    if (jobId) {
      const failureClient = await createClient();
      await failureClient.from("import_jobs").update({
        status: "failed",
        error_summary: message(error),
        completed_at: new Date().toISOString(),
      }).eq("organization_id", context.organization.id).eq("id", jobId);
    }
    target = errorPath(path, error);
  }
  redirect(target);
}
