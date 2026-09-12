"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppContext } from "@/lib/auth/session";
import { assertCanManageInventory } from "@/lib/auth/roles";
import { runOperatingLoop } from "@/lib/operations/engine";
import { createClient } from "@/lib/supabase/server";

function message(error: unknown) {
  return error instanceof Error ? error.message : "Quick-commerce analysis could not be refreshed.";
}

export async function refreshQuickCommerce() {
  const context = await requireAppContext();
  let target = "/app/quick-commerce";
  try {
    assertCanManageInventory(context.role);
    const supabase = await createClient();
    const result = await runOperatingLoop(supabase, context.organization, context.user.id);
    revalidatePath("/app/quick-commerce");
    revalidatePath("/app/ops");
    target = `/app/quick-commerce?scan=${result.calculations}`;
  } catch (error) {
    target = `/app/quick-commerce?error=${encodeURIComponent(message(error))}`;
  }
  redirect(target);
}
