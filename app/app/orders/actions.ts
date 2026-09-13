"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppContext } from "@/lib/auth/session";
import { assertCanManageInventory } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { runOrderOperatingLoop } from "@/lib/orders/operating-loop";

function message(error: unknown) { return error instanceof Error ? error.message : "Something went wrong."; }

async function transition(db: any, organizationId: string, actionId: string, from: string, to: string) {
  const result = await db.from("actions").update({ status: to })
    .eq("organization_id", organizationId).eq("id", actionId).eq("status", from).select("id").single();
  if (result.error) throw new Error(result.error.message);
}

export async function refreshOrderIntelligence() {
  const context = await requireAppContext();
  let target = "/app/orders";
  try {
    assertCanManageInventory(context.role);
    const supabase = await createClient();
    const result = await runOrderOperatingLoop(supabase as any, context.organization.id, context.user.id);
    revalidatePath("/app/orders");
    revalidatePath("/app/ops");
    revalidatePath("/app/actions");
    revalidatePath("/app/ai-copilot");
    target = `/app/orders?scanned=${result.scanned}&issues=${result.created + result.updated}&resolved=${result.resolved}`;
  } catch (error) {
    target = `/app/orders?error=${encodeURIComponent(message(error))}`;
  }
  redirect(target);
}

export async function prepareOrderRecoveryTask(formData: FormData) {
  const context = await requireAppContext();
  const issueId = String(formData.get("issue_id") ?? "");
  let target = `/app/ops/issues/${issueId}`;
  try {
    assertCanManageInventory(context.role);
    const supabase = await createClient();
    const db = supabase as any;
    const issueResult = await db.from("issues").select("*")
      .eq("organization_id", context.organization.id).eq("id", issueId).single();
    if (issueResult.error) throw new Error(issueResult.error.message);
    const issue = issueResult.data;
    if (!issue.order_id || !["ORDER_DELAYED", "ORDER_STUCK", "RTO_RISK"].includes(String(issue.type))) {
      throw new Error("This is not an actionable order exception.");
    }
    const metadata = issue.metadata as Record<string, unknown>;
    const idempotencyKey = `order-recovery:${context.organization.id}:${issue.id}`;
    const existing = await db.from("actions").select("id").eq("organization_id", context.organization.id)
      .eq("idempotency_key", idempotencyKey).maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data) {
      target = `/app/actions/${existing.data.id}`;
    } else {
      const payload = {
        order_id: issue.order_id,
        external_order_id: metadata.external_order_id,
        issue_type: issue.type,
        payment_method: metadata.payment_method,
        fulfillment_status: metadata.fulfillment_status,
        delivery_attempts: metadata.delivery_attempts,
        internal_task: metadata.internal_task,
        recommendation_title: metadata.recommendation_title,
        recommendation_detail: metadata.recommendation_detail,
        prepared_by: "ORDER_INTELLIGENCE",
        external_action_performed: false,
      };
      const created = await db.from("actions").insert({
        organization_id: context.organization.id,
        issue_id: issue.id,
        type: "CREATE_ORDER_RECOVERY_TASK",
        status: "CREATED",
        requested_by: context.user.id,
        execution_mode: "ASSISTED",
        payload,
        idempotency_key: idempotencyKey,
      }).select("id").single();
      if (created.error) throw new Error(created.error.message);
      await transition(db, context.organization.id, created.data.id, "CREATED", "VALIDATED");
      await transition(db, context.organization.id, created.data.id, "VALIDATED", "AWAITING_APPROVAL");
      const issueUpdate = await db.from("issues").update({ status: "needs_approval" })
        .eq("organization_id", context.organization.id).eq("id", issue.id);
      if (issueUpdate.error) throw new Error(issueUpdate.error.message);
      const audit = await db.from("audit_events").insert({
        organization_id: context.organization.id,
        actor_id: context.user.id,
        entity_type: "action",
        entity_id: created.data.id,
        event_type: "order_recovery_task_prepared",
        after_state: { issue_id: issue.id, order_id: issue.order_id, external_action_performed: false },
      });
      if (audit.error) throw new Error(audit.error.message);
      revalidatePath("/app/ops");
      revalidatePath("/app/actions");
      target = `/app/actions/${created.data.id}`;
    }
  } catch (error) {
    target = `/app/ops/issues/${issueId}?error=${encodeURIComponent(message(error))}`;
  }
  redirect(target);
}
