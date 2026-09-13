import type { SupabaseClient } from "@supabase/supabase-js";
import type { Action, ActionOutcome, AuditEvent, Database, ForecastCalculation, Issue, IssueRecommendation, Location, Sku } from "@/lib/supabase/database.types";

async function allRows<T>(query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getOpsInbox(supabase: SupabaseClient<Database>, organizationId: string) {
  const [issues, skus, locations, recommendations] = await Promise.all([
    allRows<Issue>(supabase.from("issues").select("*").eq("organization_id", organizationId).order("estimated_revenue_at_risk", { ascending: false, nullsFirst: false })),
    allRows<Sku>(supabase.from("skus").select("*").eq("organization_id", organizationId)),
    allRows<Location>(supabase.from("locations").select("*").eq("organization_id", organizationId)),
    allRows<IssueRecommendation>(supabase.from("issue_recommendations").select("*").eq("organization_id", organizationId)),
  ]);
  const skuById = new Map(skus.map((row) => [row.id, row]));
  const locationById = new Map(locations.map((row) => [row.id, row]));
  const recommendationByIssue = new Map(recommendations.map((row) => [row.issue_id, row]));
  return issues.map((issue) => ({ issue, sku: issue.sku_id ? skuById.get(issue.sku_id) : undefined, location: issue.location_id ? locationById.get(issue.location_id) : undefined, recommendation: recommendationByIssue.get(issue.id), sourceLocation: recommendationByIssue.get(issue.id)?.source_location_id ? locationById.get(recommendationByIssue.get(issue.id)!.source_location_id!) : undefined }));
}

export async function getIssueDetail(supabase: SupabaseClient<Database>, organizationId: string, issueId: string) {
  const db = supabase as any;
  const issueResult = await db.from("issues").select("*").eq("organization_id", organizationId).eq("id", issueId).maybeSingle();
  if (issueResult.error) throw new Error(issueResult.error.message);
  if (!issueResult.data) return null;
  const issue = issueResult.data as any;
  const [skuResult, locationResult, forecastResult, recommendationResult, actions, auditEvents, orderResult] = await Promise.all([
    issue.sku_id ? db.from("skus").select("*").eq("organization_id", organizationId).eq("id", issue.sku_id).single() : Promise.resolve({ data: null, error: null }),
    issue.location_id ? db.from("locations").select("*").eq("organization_id", organizationId).eq("id", issue.location_id).single() : Promise.resolve({ data: null, error: null }),
    issue.forecast_calculation_id ? db.from("forecast_calculations").select("*").eq("organization_id", organizationId).eq("id", issue.forecast_calculation_id).single() : Promise.resolve({ data: null, error: null }),
    db.from("issue_recommendations").select("*").eq("organization_id", organizationId).eq("issue_id", issue.id).maybeSingle(),
    allRows<Action>(db.from("actions").select("*").eq("organization_id", organizationId).eq("issue_id", issue.id).order("created_at", { ascending: false })),
    allRows<AuditEvent>(db.from("audit_events").select("*").eq("organization_id", organizationId).eq("entity_id", issue.id).order("created_at", { ascending: false })),
    issue.order_id ? db.from("orders").select("*").eq("organization_id", organizationId).eq("id", issue.order_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if (skuResult.error) throw new Error(skuResult.error.message);
  if (locationResult.error) throw new Error(locationResult.error.message);
  if (forecastResult.error) throw new Error(forecastResult.error.message);
  if (recommendationResult.error) throw new Error(recommendationResult.error.message);
  if (orderResult.error) throw new Error(orderResult.error.message);
  const sourceResult = recommendationResult.data?.source_location_id ? await db.from("locations").select("*").eq("organization_id", organizationId).eq("id", recommendationResult.data.source_location_id).single() : { data: null, error: null };
  if (sourceResult.error) throw new Error(sourceResult.error.message);
  return { issue, sku: skuResult.data as Sku | null, location: locationResult.data as Location | null, forecast: forecastResult.data as ForecastCalculation | null, recommendation: recommendationResult.data as IssueRecommendation | null, sourceLocation: sourceResult.data as Location | null, actions, auditEvents, order: orderResult.data };
}

export async function getActions(supabase: SupabaseClient<Database>, organizationId: string) {
  const [actions, outcomes, issues] = await Promise.all([
    allRows<Action>(supabase.from("actions").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false })),
    allRows<ActionOutcome>(supabase.from("action_outcomes").select("*").eq("organization_id", organizationId)),
    allRows<Issue>(supabase.from("issues").select("*").eq("organization_id", organizationId)),
  ]);
  const outcomeByAction = new Map(outcomes.map((outcome) => [outcome.action_id, outcome]));
  const issueById = new Map(issues.map((issue) => [issue.id, issue]));
  return actions.map((action) => ({ action, outcome: outcomeByAction.get(action.id), issue: action.issue_id ? issueById.get(action.issue_id) : undefined }));
}

export async function getValueMetrics(supabase: SupabaseClient<Database>, organizationId: string) {
  const [issues, actions, outcomes, recommendations] = await Promise.all([
    allRows<Issue>(supabase.from("issues").select("*").eq("organization_id", organizationId)),
    allRows<Action>(supabase.from("actions").select("*").eq("organization_id", organizationId)),
    allRows<ActionOutcome>(supabase.from("action_outcomes").select("*").eq("organization_id", organizationId)),
    allRows<IssueRecommendation>(supabase.from("issue_recommendations").select("*").eq("organization_id", organizationId)),
  ]);
  const verified = actions.filter((action) => action.status === "VERIFIED");
  const resolutionHours = verified.flatMap((action) => {
    const outcome = outcomes.find((item) => item.action_id === action.id);
    return outcome?.verified_at ? [(new Date(outcome.verified_at).getTime() - new Date(action.created_at).getTime()) / 3_600_000] : [];
  });
  return {
    revenueAtRisk: issues.reduce((sum, issue) => sum + Number(issue.estimated_revenue_at_risk ?? 0), 0),
    estimatedRevenueProtected: outcomes.reduce((sum, outcome) => sum + Number(outcome.estimated_value_protected), 0),
    actualRevenueProtected: outcomes.filter((outcome) => outcome.success).reduce((sum, outcome) => sum + Number(outcome.actual_value_protected ?? 0), 0),
    stockoutsPrevented: outcomes.filter((outcome) => outcome.success).length,
    inventoryRebalanced: recommendations.filter((recommendation) => actions.some((action) => action.issue_id === recommendation.issue_id && ["EXECUTED", "VERIFYING", "VERIFIED"].includes(action.status))).reduce((sum, recommendation) => sum + recommendation.quantity, 0),
    actionsApproved: actions.filter((action) => action.approved_at).length,
    actionsVerified: verified.length,
    averageResolutionHours: resolutionHours.length ? resolutionHours.reduce((sum, hours) => sum + hours, 0) / resolutionHours.length : null,
  };
}
