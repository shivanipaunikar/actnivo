"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppContext } from "@/lib/auth/session";
import { assertCanManageInventory } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { parseOrderFile } from "@/lib/orders/file-import";
import { ingestNormalizedOrders } from "@/lib/orders/ingestion";

const message = (error: unknown) => error instanceof Error ? error.message : "Order import failed.";

export async function importOrders(formData: FormData) {
  const context = await requireAppContext();
  let target = "/app/orders/import";
  try {
    assertCanManageInventory(context.role);
    const file = formData.get("file");
    if (!(file instanceof File) || !file.name) throw new Error("Choose a CSV or XLSX file.");
    if (file.size > 10 * 1024 * 1024) throw new Error("Order files must be 10 MB or smaller.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const records = await parseOrderFile(file.name, bytes);
    const supabase = await createClient();
    const result = await ingestNormalizedOrders({
      supabase: supabase as any,
      organizationId: context.organization.id,
      country: context.organization.country,
      records,
      actorId: context.user.id,
    });
    revalidatePath("/app/orders");
    revalidatePath("/app/ai-copilot");
    target = `/app/orders?imported=${result.imported}`;
  } catch (error) {
    target = `/app/orders/import?error=${encodeURIComponent(message(error))}`;
  }
  redirect(target);
}
