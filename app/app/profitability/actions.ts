"use server";

import { revalidatePath } from "next/cache";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function updateSkuCost(formData: FormData) {
  const { organization } = await requireAppContext();
  const skuId = String(formData.get("sku_id") ?? "");
  const raw = String(formData.get("cost_price") ?? "").trim();
  if (!skuId) throw new Error("SKU is required.");
  if (!raw) throw new Error("Cost price is required.");
  const cost = Number(raw);
  if (!Number.isFinite(cost) || cost < 0) throw new Error("Cost price must be 0 or more.");
  const supabase = await createClient();
  const result = await (supabase as any).from("skus").update({ cost_price: cost }).eq("organization_id", organization.id).eq("id", skuId);
  if (result.error) throw new Error(result.error.message);
  revalidatePath("/app/profitability");
}
