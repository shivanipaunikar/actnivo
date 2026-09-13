export type AnalyticsInput = {
  issues: any[];
  actions: any[];
  outcomes: any[];
  skus: any[];
  locations: any[];
};

const activeStatuses = new Set(["open", "needs_approval", "running"]);
const terminalActionStatuses = new Set(["VERIFIED", "FAILED", "CANCELLED"]);
const workflowForIssue = (issue: any) => {
  const metadata = issue?.metadata && typeof issue.metadata === "object" ? issue.metadata : {};
  const recommendationType = String(metadata.recommendation_type ?? "");
  if (String(issue.type).startsWith("PO_") || recommendationType === "EXPEDITE_PO") return "Purchase Orders";
  if (["ORDER_DELAYED", "ORDER_STUCK", "RTO_RISK"].includes(issue.type) || recommendationType === "CREATE_ORDER_RECOVERY_TASK") return "Orders";
  if (["RETURN_STUCK", "REFUND_DELAYED", "RETURN_RECEIPT_DELAYED"].includes(issue.type) || recommendationType === "CREATE_RETURN_RECOVERY_TASK") return "Returns & RTO";
  return "Inventory";
};
const sum = (rows: any[], value: (row: any) => number) => rows.reduce((total, row) => total + value(row), 0);
const sortValue = <T extends { value: number }>(rows: T[]) => rows.sort((a, b) => b.value - a.value);

export function buildAnalytics(input: AnalyticsInput) {
  const skuMap = new Map(input.skus.map((sku) => [sku.id, sku]));
  const locationMap = new Map(input.locations.map((location) => [location.id, location]));
  const activeIssues = input.issues.filter((issue) => activeStatuses.has(issue.status));
  const resolvedIssues = input.issues.filter((issue) => issue.status === "resolved");
  const revenueAtRisk = sum(activeIssues, (issue) => Number(issue.estimated_revenue_at_risk ?? 0));

  const aggregate = (keyFor: (issue: any) => string, labelFor?: (key: string) => string) => {
    const map = new Map<string, { count: number; value: number }>();
    for (const issue of activeIssues) {
      const key = keyFor(issue) || "Unassigned";
      const current = map.get(key) ?? { count: 0, value: 0 };
      current.count += 1;
      current.value += Number(issue.estimated_revenue_at_risk ?? 0);
      map.set(key, current);
    }
    return sortValue([...map.entries()].map(([key, item]) => ({ key, label: labelFor ? labelFor(key) : key.replaceAll("_", " "), ...item })));
  };

  const byWorkflow = aggregate(workflowForIssue);
  const bySeverity = aggregate((issue) => issue.severity);
  const byChannel = aggregate((issue) => issue.channel ?? "unassigned");
  const byLocation = aggregate((issue) => issue.location_id ?? "unassigned", (key) => key === "unassigned" ? "Unassigned" : locationMap.get(key)?.name ?? "Unknown location");
  const bySku = aggregate((issue) => issue.sku_id ?? "unassigned", (key) => {
    if (key === "unassigned") return "Unassigned";
    const sku = skuMap.get(key);
    return sku ? `${sku.master_sku} · ${sku.product_name}` : "Unknown SKU";
  });

  const approvedActions = input.actions.filter((action) => ["APPROVED", "EXECUTING", "EXECUTED", "VERIFYING", "VERIFIED"].includes(action.status));
  const verifiedActions = input.actions.filter((action) => action.status === "VERIFIED");
  const waitingApproval = input.actions.filter((action) => action.status === "AWAITING_APPROVAL");
  const autopilotActions = input.actions.filter((action) => action?.payload?.prepared_by === "AUTOPILOT");
  const verificationSuccesses = input.outcomes.filter((outcome) => outcome.verification_status === "SUCCESS" || outcome.success === true);
  const actualValueProtected = sum(verificationSuccesses, (outcome) => Number(outcome.actual_value_protected ?? 0));
  const estimatedValueProtected = sum(input.outcomes, (outcome) => Number(outcome.estimated_value_protected ?? 0));
  const verificationRate = approvedActions.length ? verifiedActions.length / approvedActions.length : 0;
  const resolutionRate = input.issues.length ? resolvedIssues.length / input.issues.length : 0;

  const actionStatus = new Map<string, number>();
  for (const action of input.actions) actionStatus.set(action.status, (actionStatus.get(action.status) ?? 0) + 1);

  return {
    summary: {
      activeIssues: activeIssues.length,
      revenueAtRisk,
      resolvedIssues: resolvedIssues.length,
      resolutionRate,
      waitingApproval: waitingApproval.length,
      autopilotPrepared: autopilotActions.length,
      verifiedActions: verifiedActions.length,
      verificationRate,
      estimatedValueProtected,
      actualValueProtected,
    },
    byWorkflow,
    bySeverity,
    byChannel,
    byLocation,
    bySku,
    actionStatus: [...actionStatus.entries()].map(([status, count]) => ({ status, count, terminal: terminalActionStatuses.has(status) })).sort((a, b) => b.count - a.count),
  };
}
