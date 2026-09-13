type Policy = {
  id: string;
  workflow: "INVENTORY_TRANSFER" | "REPLENISHMENT" | "PO_EXPEDITE" | "ORDER_RECOVERY" | "RETURN_RECOVERY";
  enabled: boolean;
  minimum_revenue_at_risk: number | string;
  minimum_confidence: number | string;
  daily_action_cap: number;
  approval_required: boolean;
  external_execution_enabled: boolean;
};

const asRecord = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const active = (status: string) => !["resolved", "ignored"].includes(status);

function workflowForIssue(issue: any, recommendation: any) {
  const metadata = asRecord(issue.metadata);
  if (issue.type === "STOCKOUT_RISK") return recommendation?.source_location_id ? "INVENTORY_TRANSFER" : "REPLENISHMENT";
  if (String(metadata.recommendation_type ?? "") === "EXPEDITE_PO") return "PO_EXPEDITE";
  if (String(metadata.recommendation_type ?? "") === "CREATE_ORDER_RECOVERY_TASK") return "ORDER_RECOVERY";
  if (String(metadata.recommendation_type ?? "") === "CREATE_RETURN_RECOVERY_TASK") return "RETURN_RECOVERY";
  return null;
}

function actionTypeForWorkflow(workflow: Policy["workflow"]) {
  return {
    INVENTORY_TRANSFER: "CREATE_TRANSFER_PLAN",
    REPLENISHMENT: "CREATE_REPLENISHMENT_PLAN",
    PO_EXPEDITE: "EXPEDITE_PO",
    ORDER_RECOVERY: "CREATE_ORDER_RECOVERY_TASK",
    RETURN_RECOVERY: "CREATE_RETURN_RECOVERY_TASK",
  }[workflow];
}

async function buildPayload(db: any, organizationId: string, issue: any, recommendation: any, workflow: Policy["workflow"]) {
  const metadata = asRecord(issue.metadata);
  const base = {
    prepared_by: "AUTOPILOT",
    policy_workflow: workflow,
    external_action_performed: false,
    external_execution_enabled: false,
  };

  if (workflow === "ORDER_RECOVERY") return {
    ...base,
    order_id: issue.order_id,
    external_order_id: metadata.external_order_id,
    issue_type: issue.type,
    payment_method: metadata.payment_method,
    fulfillment_status: metadata.fulfillment_status,
    delivery_attempts: metadata.delivery_attempts,
    recommendation_title: metadata.recommendation_title,
    recommendation_detail: metadata.recommendation_detail,
    internal_task: metadata.internal_task,
  };

  if (workflow === "RETURN_RECOVERY") return {
    ...base,
    return_id: issue.return_id,
    external_return_id: metadata.external_return_id,
    issue_type: issue.type,
    return_kind: metadata.return_kind,
    return_status: metadata.return_status,
    external_order_id: metadata.external_order_id,
    recommendation_title: metadata.recommendation_title,
    recommendation_detail: metadata.recommendation_detail,
    internal_task: metadata.internal_task,
  };

  const skuResult = await db.from("skus").select("*").eq("organization_id", organizationId).eq("id", issue.sku_id).single();
  if (skuResult.error) throw new Error(skuResult.error.message);
  const sku = skuResult.data;

  if (workflow === "INVENTORY_TRANSFER") {
    const [sourceResult, destinationResult] = await Promise.all([
      db.from("locations").select("*").eq("organization_id", organizationId).eq("id", recommendation.source_location_id).single(),
      db.from("locations").select("*").eq("organization_id", organizationId).eq("id", recommendation.destination_location_id).single(),
    ]);
    if (sourceResult.error || destinationResult.error) throw new Error("Autopilot could not resolve the recommended transfer locations.");
    const calc = asRecord(recommendation.calculation);
    return {
      ...base,
      sku_id: sku.id,
      master_sku: sku.master_sku,
      product_name: sku.product_name,
      channel: issue.channel,
      source_location_id: sourceResult.data.id,
      source_location: sourceResult.data.name,
      destination_location_id: destinationResult.data.id,
      destination_location: destinationResult.data.name,
      quantity: recommendation.quantity,
      before_quantity: Number(calc.destination_available ?? 0),
      expected_quantity: Number(calc.destination_available ?? 0) + Number(recommendation.quantity),
      selling_price: Number(sku.selling_price ?? 0),
      internal_task: `Transfer ${recommendation.quantity} units of ${sku.master_sku} from ${sourceResult.data.name} to ${destinationResult.data.name}.`,
    };
  }

  if (workflow === "PO_EXPEDITE") {
    const poId = String(metadata.purchase_order_id ?? "");
    const poResult = await db.from("purchase_orders").select("*").eq("organization_id", organizationId).eq("id", poId).single();
    if (poResult.error) throw new Error("Autopilot could not resolve the purchase order.");
    const arriveBy = String(metadata.projected_stockout_at ?? poResult.data.expected_delivery_date);
    return {
      ...base,
      purchase_order_id: poResult.data.id,
      po_number: poResult.data.external_po_number,
      supplier_name: poResult.data.supplier_name,
      original_expected_delivery_date: poResult.data.expected_delivery_date,
      arrive_by: arriveBy,
      sku_id: sku.id,
      master_sku: sku.master_sku,
      internal_task: `Request an earlier arrival for PO ${poResult.data.external_po_number} from ${poResult.data.supplier_name}.`,
      supplier_request: `Please review PO ${poResult.data.external_po_number}. Current demand indicates stock may run out before the expected arrival. Please confirm whether delivery can be expedited to ${new Date(arriveBy).toLocaleDateString("en-IN")}.`,
      external_contact_performed: false,
    };
  }

  const destinationResult = await db.from("locations").select("*").eq("organization_id", organizationId).eq("id", issue.location_id).single();
  if (destinationResult.error) throw new Error("Autopilot could not resolve the replenishment destination.");
  const quantity = Math.max(1, Number(issue.estimated_shortage_units ?? 0));
  return {
    ...base,
    sku_id: sku.id,
    master_sku: sku.master_sku,
    product_name: sku.product_name,
    destination_location_id: destinationResult.data.id,
    destination_location: destinationResult.data.name,
    quantity,
    selling_price: Number(sku.selling_price ?? 0),
    internal_task: `Replenish ${quantity} units of ${sku.master_sku} into ${destinationResult.data.name}.`,
  };
}

export async function runAutopilot(db: any, organizationId: string, actorId: string) {
  const [policiesResult, issuesResult, recommendationsResult, todayActionsResult] = await Promise.all([
    db.from("autopilot_policies").select("*").eq("organization_id", organizationId),
    db.from("issues").select("*").eq("organization_id", organizationId),
    db.from("issue_recommendations").select("*").eq("organization_id", organizationId),
    db.from("actions").select("id,type,payload,created_at").eq("organization_id", organizationId).gte("created_at", new Date(new Date().setHours(0,0,0,0)).toISOString()),
  ]);
  for (const result of [policiesResult, issuesResult, recommendationsResult, todayActionsResult]) if (result.error) throw new Error(result.error.message);

  const policies = (policiesResult.data ?? []) as Policy[];
  const policyMap = new Map(policies.map((policy) => [policy.workflow, policy]));
  const recommendationMap = new Map((recommendationsResult.data ?? []).map((recommendation: any) => [recommendation.issue_id, recommendation]));
  const counts = new Map<string, number>();
  for (const action of todayActionsResult.data ?? []) {
    const workflow = String(asRecord(action.payload).policy_workflow ?? "");
    if (workflow) counts.set(workflow, (counts.get(workflow) ?? 0) + 1);
  }

  let eligible = 0;
  let prepared = 0;
  let skippedDailyCap = 0;
  const decisions: any[] = [];

  for (const issue of (issuesResult.data ?? []).filter((row: any) => active(row.status))) {
    const recommendation = recommendationMap.get(issue.id);
    const workflow = workflowForIssue(issue, recommendation) as Policy["workflow"] | null;
    if (!workflow) continue;
    const policy = policyMap.get(workflow);
    if (!policy?.enabled) { decisions.push({ issue_id: issue.id, workflow, decision: "disabled" }); continue; }
    const risk = Number(issue.estimated_revenue_at_risk ?? 0);
    const confidence = issue.confidence == null ? 1 : Number(issue.confidence);
    if (risk < Number(policy.minimum_revenue_at_risk)) { decisions.push({ issue_id: issue.id, workflow, decision: "below_revenue_threshold", risk }); continue; }
    if (confidence < Number(policy.minimum_confidence)) { decisions.push({ issue_id: issue.id, workflow, decision: "below_confidence_threshold", confidence }); continue; }
    eligible++;
    if ((counts.get(workflow) ?? 0) >= Number(policy.daily_action_cap)) { skippedDailyCap++; decisions.push({ issue_id: issue.id, workflow, decision: "daily_cap" }); continue; }

    const actionType = actionTypeForWorkflow(workflow);
    const idempotencyKey = `${organizationId}:autopilot:${issue.id}:${actionType}:v1`;
    const existing = await db.from("actions").select("id").eq("organization_id", organizationId).eq("idempotency_key", idempotencyKey).maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data) { decisions.push({ issue_id: issue.id, workflow, decision: "already_prepared", action_id: existing.data.id }); continue; }

    const payload = await buildPayload(db, organizationId, issue, recommendation, workflow);
    const created = await db.from("actions").insert({
      organization_id: organizationId,
      issue_id: issue.id,
      type: actionType,
      status: "AWAITING_APPROVAL",
      requested_by: actorId,
      execution_mode: "ASSISTED",
      payload,
      idempotency_key: idempotencyKey,
    }).select("id").single();
    if (created.error) throw new Error(created.error.message);
    const issueUpdate = await db.from("issues").update({ status: "needs_approval" }).eq("organization_id", organizationId).eq("id", issue.id);
    if (issueUpdate.error) throw new Error(issueUpdate.error.message);
    const audit = await db.from("audit_events").insert({
      organization_id: organizationId,
      actor_id: actorId,
      entity_type: "action",
      entity_id: created.data.id,
      event_type: "autopilot_action_prepared",
      before_state: null,
      after_state: { workflow, policy_id: policy.id, issue_id: issue.id, revenue_at_risk: risk, confidence, approval_required: true, external_action_performed: false },
    });
    if (audit.error) throw new Error(audit.error.message);
    prepared++;
    counts.set(workflow, (counts.get(workflow) ?? 0) + 1);
    decisions.push({ issue_id: issue.id, workflow, decision: "prepared", action_id: created.data.id });
  }

  const run = await db.from("autopilot_runs").insert({
    organization_id: organizationId,
    requested_by: actorId,
    scanned_issues: (issuesResult.data ?? []).filter((row: any) => active(row.status)).length,
    eligible_issues: eligible,
    prepared_actions: prepared,
    skipped_daily_cap: skippedDailyCap,
    details: { decisions },
  }).select("id").single();
  if (run.error) throw new Error(run.error.message);
  return { runId: run.data.id, scanned: (issuesResult.data ?? []).filter((row: any) => active(row.status)).length, eligible, prepared, skippedDailyCap, decisions };
}
