type ValueInput = {
  issues: any[];
  actions: any[];
  outcomes: any[];
  recommendations: any[];
  skus: any[];
  locations: any[];
};

const successful = (outcome: any) => outcome?.success === true || outcome?.verification_status === "SUCCESS";
const asRecord = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const workflowForIssue = (issue: any) => {
  const metadata = asRecord(issue?.metadata);
  const recommendationType = String(metadata.recommendation_type ?? "");
  if (String(issue?.type ?? "").startsWith("PO_") || recommendationType === "EXPEDITE_PO") return "Purchase Orders";
  if (["ORDER_DELAYED", "ORDER_STUCK", "RTO_RISK"].includes(issue?.type) || recommendationType === "CREATE_ORDER_RECOVERY_TASK") return "Orders";
  if (["RETURN_STUCK", "REFUND_DELAYED", "RETURN_RECEIPT_DELAYED"].includes(issue?.type) || recommendationType === "CREATE_RETURN_RECOVERY_TASK") return "Returns & RTO";
  return "Inventory";
};

export function buildValueGenerated(input: ValueInput) {
  const issueMap = new Map(input.issues.map((issue) => [issue.id, issue]));
  const actionMap = new Map(input.actions.map((action) => [action.id, action]));
  const skuMap = new Map(input.skus.map((sku) => [sku.id, sku]));
  const locationMap = new Map(input.locations.map((location) => [location.id, location]));
  const recommendationMap = new Map(input.recommendations.map((recommendation) => [recommendation.issue_id, recommendation]));
  const verifiedOutcomes = input.outcomes.filter(successful);
  const verifiedActions = input.actions.filter((action) => action.status === "VERIFIED");
  const approvedActions = input.actions.filter((action) => action.approved_at || ["APPROVED", "EXECUTING", "EXECUTED", "VERIFYING", "VERIFIED"].includes(action.status));

  const actualValue = verifiedOutcomes.reduce((sum, outcome) => sum + Number(outcome.actual_value_protected ?? 0), 0);
  const estimatedValue = input.outcomes.reduce((sum, outcome) => sum + Number(outcome.estimated_value_protected ?? 0), 0);
  const actualByWorkflow = new Map<string, number>();
  const actualBySku = new Map<string, number>();
  const actualByChannel = new Map<string, number>();
  const actualByLocation = new Map<string, number>();
  const actualByMonth = new Map<string, number>();
  let autopilotActual = 0;
  let manualActual = 0;
  let estimatedMarginProtected = 0;
  let marginCoverageValue = 0;

  for (const outcome of verifiedOutcomes) {
    const value = Number(outcome.actual_value_protected ?? 0);
    const action = actionMap.get(outcome.action_id);
    const issue = action?.issue_id ? issueMap.get(action.issue_id) : null;
    const workflow = issue ? workflowForIssue(issue) : "Other";
    actualByWorkflow.set(workflow, (actualByWorkflow.get(workflow) ?? 0) + value);

    if (issue?.sku_id) actualBySku.set(issue.sku_id, (actualBySku.get(issue.sku_id) ?? 0) + value);
    actualByChannel.set(issue?.channel ?? "unassigned", (actualByChannel.get(issue?.channel ?? "unassigned") ?? 0) + value);
    actualByLocation.set(issue?.location_id ?? "unassigned", (actualByLocation.get(issue?.location_id ?? "unassigned") ?? 0) + value);

    const when = outcome.verified_at ?? action?.updated_at ?? action?.created_at;
    if (when) {
      const d = new Date(when);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      actualByMonth.set(key, (actualByMonth.get(key) ?? 0) + value);
    }

    if (asRecord(action?.payload).prepared_by === "AUTOPILOT") autopilotActual += value;
    else manualActual += value;

    const sku = issue?.sku_id ? skuMap.get(issue.sku_id) : null;
    const selling = Number(sku?.selling_price ?? 0);
    const cost = sku?.cost_price == null ? null : Number(sku.cost_price);
    if (selling > 0 && cost != null && cost >= 0 && cost <= selling) {
      const marginRate = (selling - cost) / selling;
      estimatedMarginProtected += value * marginRate;
      marginCoverageValue += value;
    }
  }

  const resolutionHours = verifiedActions.flatMap((action) => {
    const outcome = input.outcomes.find((item) => item.action_id === action.id);
    return outcome?.verified_at ? [(new Date(outcome.verified_at).getTime() - new Date(action.created_at).getTime()) / 3_600_000] : [];
  });

  const inventoryRebalanced = input.recommendations
    .filter((recommendation) => input.actions.some((action) => action.issue_id === recommendation.issue_id && ["EXECUTED", "VERIFYING", "VERIFIED"].includes(action.status)))
    .reduce((sum, recommendation) => sum + Number(recommendation.quantity ?? 0), 0);

  const rows = (map: Map<string, number>, labelFor: (key: string) => string) => [...map.entries()]
    .map(([key, value]) => ({ key, label: labelFor(key), value }))
    .sort((a, b) => b.value - a.value);

  return {
    summary: {
      identifiedRisk: input.issues.reduce((sum, issue) => sum + Number(issue.estimated_revenue_at_risk ?? 0), 0),
      estimatedValue,
      actualValue,
      estimatedMarginProtected,
      marginCoveragePercent: actualValue > 0 ? marginCoverageValue / actualValue : 0,
      stockoutsPrevented: verifiedOutcomes.filter((outcome) => {
        const action = actionMap.get(outcome.action_id);
        const issue = action?.issue_id ? issueMap.get(action.issue_id) : null;
        return issue?.type === "STOCKOUT_RISK";
      }).length,
      inventoryRebalanced,
      approvedActions: approvedActions.length,
      verifiedActions: verifiedActions.length,
      verificationRate: approvedActions.length ? verifiedActions.length / approvedActions.length : 0,
      averageResolutionHours: resolutionHours.length ? resolutionHours.reduce((sum, value) => sum + value, 0) / resolutionHours.length : null,
      autopilotActual,
      manualActual,
    },
    byWorkflow: rows(actualByWorkflow, (key) => key),
    bySku: rows(actualBySku, (key) => {
      const sku = skuMap.get(key);
      return sku ? `${sku.master_sku} · ${sku.product_name}` : "Unknown SKU";
    }),
    byChannel: rows(actualByChannel, (key) => key === "unassigned" ? "Unassigned" : key.replaceAll("_", " ")),
    byLocation: rows(actualByLocation, (key) => key === "unassigned" ? "Unassigned" : locationMap.get(key)?.name ?? "Unknown location"),
    trend: [...actualByMonth.entries()].map(([month, value]) => ({ month, value })).sort((a, b) => a.month.localeCompare(b.month)),
    recommendationCount: recommendationMap.size,
  };
}
