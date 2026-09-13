"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppContext } from "@/lib/auth/session";
import { assertCanManageInventory } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { parseReturnFile } from "@/lib/returns-rto/file-import";
import { ingestNormalizedReturns } from "@/lib/returns-rto/ingestion";

const message=(error:unknown)=>error instanceof Error?error.message:"Return/RTO import failed.";
export async function importReturnsRto(formData:FormData){
  const context=await requireAppContext(); let target="/app/returns-rto/import";
  try{assertCanManageInventory(context.role);const file=formData.get("file");if(!(file instanceof File)||!file.name)throw new Error("Choose a CSV or XLSX file.");if(file.size>10*1024*1024)throw new Error("Files must be 10 MB or smaller.");const records=await parseReturnFile(file.name,new Uint8Array(await file.arrayBuffer()));const supabase=await createClient();const result=await ingestNormalizedReturns({supabase:supabase as any,organizationId:context.organization.id,records});revalidatePath("/app/returns-rto");revalidatePath("/app/ai-copilot");target=`/app/returns-rto?imported=${result.imported}`;}catch(error){target=`/app/returns-rto/import?error=${encodeURIComponent(message(error))}`;}redirect(target);
}
