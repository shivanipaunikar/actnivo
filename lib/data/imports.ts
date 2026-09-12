import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ImportJob, ImportRow } from "@/lib/supabase/database.types";

export async function getImportJob(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  jobId: string,
) {
  const { data, error } = await supabase
    .from("import_jobs")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as ImportJob | null;
}

export async function getAllImportRows(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  jobId: string,
) {
  const rows: ImportRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("import_rows")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("import_job_id", jobId)
      .order("row_number")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as ImportRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

export async function getRecentImportJobs(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  limit = 8,
) {
  const { data, error } = await supabase
    .from("import_jobs")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as ImportJob[];
}

export function importStatusLabel(status: ImportJob["status"]) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
