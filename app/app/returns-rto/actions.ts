"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppContext } from "@/lib/auth/session";
import { assertCanManageInventory } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { runReturnsRtoOperatingLoop } from "@/lib/returns-rto/operating-loop";

const message = (error: unknown) => error instanceof Error ? error.message : "Something went wrong.";

export async function refreshReturnsRtoIntelligence() {
  const context = await requireAppContext();
  let target = "/app/returns-rto";
  try {
    assertCanManageInventory(context.role);
    const supabase = await createClient();
    const result = await runReturnsRtoOperatingLoop(supabase as any, context.organization.id, context.user.id);
    revalidatePath("/app/returns-rto"); revalidatePath("/app/ops"); revalidatePath("/app/ai-copilot");
    target = `/app/returns-rto?scan=${result.scanned}&created=${result.created}&resolved=${result.resolved}`;
  } catch (error) { target = `/app/returns-rto?error=${encodeURIComponent(message(error))}`; }
  redirect(target);
}

export async function prepareReturnRecovery(formData: FormData) {
  const context = await requireAppContext();
  const issueId = String(formData.get("issue_id") ?? "");
  let target = `/app/ops/issues/${issueId}`;
  try {
    assertCanManageInventory(context.role);
    const supabase = await createClient(); const db = supabase as any;
    const issueResult = await db.from("issues").select("*").eq("organization_id", context.organization.id).eq("id", issueId).single();
    if (issueResult.error) throw new Error(issueResult.error.message);
    const issue = issueResult.data; const metadata = issue.metadata as Record<string, unknown>;
    if (String(metadata.recommendation_type ?? "") !== "CREATE_RETURN_RECOVERY_TASK") throw new Error("This issue does not have a return/RTO recovery recommendation.");
    const idempotencyKey = `${context.organization.id}:return-recovery:${issueId}:v1`;
    const existing = await db.from("actions").select("id").eq("organization_id", context.organization.id).eq("idempotency_key", idempotencyKey).maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data) redirect(`/app/actions/${existing.data.id}`);
    const created = await db.from("actions").insert({ organization_id: context.organization.id, issue_id: issueId, type: "CREATE_RETURN_RECOVERY_TASK", status: "AWAITING_APPROVAL", requested_by: context.user.id, execution_mode: "ASSISTED", payload: { prepared_by: "RETURNS_RTO_INTELLIGENCE", return_id: metadata.return_id, external_return_id: metadata.external_return_id, order_id: metadata.order_id, kind: metadata.kind, issue_type: issue.type, refund_amount: metadata.refund_amount, reverse_logistics_cost: metadata.reverse_logistics_cost, internal_task: metadata.internal_task, external_action_performed: false }, idempotency_key: idempotencyKey }).select("id").single();
    if (created.error) throw new Error(created.error.message);
    const update = await db.from("issues").update({ status: "needs_approval" }).eq("organization_id", context.organization.id).eq("id", issueId);
    if (update.error) throw new Error(update.error.message);
    revalidatePath("/app/ops"); revalidatePath("/app/actions");
    target = `/app/actions/${created.data.id}`;
  } catch (error) { target = `/app/ops/issues/${issueId}?error=${encodeURIComponent(message(error))}`; }
  redirect(target);
}
