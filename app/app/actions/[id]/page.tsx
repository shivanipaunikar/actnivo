import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAppContext } from "@/lib/auth/session";
import { canManageInventory } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { approvePreparedAction } from "../actions";

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

function ApprovalPanel({ actionId, manageable }: { actionId: string; manageable: boolean }) {
  if (!manageable) return <p>Your role can review this proposal but cannot approve operational actions.</p>;
  return <form action={approvePreparedAction} className="copilot-action-approval"><input type="hidden" name="action_id" value={actionId} /><button className="saas-primary" type="submit">Approve proposed action</button><small>Approval starts assisted execution only. No external API, supplier message, customer contact, carrier action, refund, or marketplace mutation is performed.</small></form>;
}

export default async function ActionDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ approved?: string; error?: string }> }) {
  const [{ id }, query, context] = await Promise.all([params, searchParams, requireAppContext()]);
  const supabase = await createClient();
  const [actionResult, outcomeResult] = await Promise.all([
    supabase.from("actions").select("*").eq("organization_id", context.organization.id).eq("id", id).maybeSingle(),
    supabase.from("action_outcomes").select("*").eq("organization_id", context.organization.id).eq("action_id", id).maybeSingle(),
  ]);
  if (actionResult.error || !actionResult.data) notFound();
  if (outcomeResult.error) throw new Error(outcomeResult.error.message);
  const action = actionResult.data;
  const outcome = outcomeResult.data;
  const payload = action.payload as Record<string, unknown>;
  const actionType = String(action.type);
  const isExpedite = actionType === "EXPEDITE_PO";
  const isReplenishment = actionType === "CREATE_REPLENISHMENT_PLAN";
  const isOrderRecovery = actionType === "CREATE_ORDER_RECOVERY_TASK";
  const isReturnRecovery = actionType === "CREATE_RETURN_RECOVERY_TASK";
  const awaitingApproval = action.status === "AWAITING_APPROVAL";
  const manageable = canManageInventory(context.role);
  const preparedByCopilot = String(payload.prepared_by ?? "") === "AI_COPILOT";

  if (isReturnRecovery) return <div className="product-page action-detail-page">
    <header className="product-page-header"><div><p>ACTIONS / ASSISTED</p><h1>{awaitingApproval ? "Proposed return/RTO recovery" : "Return/RTO recovery task"}</h1><span>{String(payload.external_return_id ?? "Return/RTO")} · {String(payload.kind ?? "RETURN")}</span></div><Link href="/app/actions">← All actions</Link></header>
    {query.error && <p className="product-alert error">{query.error}</p>}{query.approved && <p className="product-alert success">Approved. The internal reverse-logistics recovery task is ready.</p>}
    <section className="assisted-banner"><span>{awaitingApproval ? "RETURNS & RTO PROPOSAL" : "ASSISTED EXECUTION"}</span><h2>{awaitingApproval ? "Review before approval." : "No refund, customer, carrier, OMS, or marketplace action was performed."}</h2><p>{awaitingApproval ? "The proposal is based on deterministic return/RTO exception logic. Approval creates an internal task only." : "Complete the recovery step in your operational system. Actnivo verifies the outcome when refreshed return/RTO data clears the exception."}</p>{awaitingApproval && <ApprovalPanel actionId={action.id} manageable={manageable} />}</section>
    <div className="action-detail-grid"><section><small>INTERNAL TASK</small><h2>{String(payload.internal_task ?? "Review and recover the affected return/RTO case.")}</h2><div className="action-quantity"><span>CASE<strong>{String(payload.external_return_id ?? "—")}</strong></span><span>KIND<strong>{String(payload.kind ?? "—")}</strong></span><span>REFUND EXPOSURE<strong>{currency.format(Number(payload.refund_amount ?? 0))}</strong></span></div></section><aside><small>{awaitingApproval ? "PROPOSAL STATUS" : "VERIFICATION"}</small><span className={`action-state ${action.status.toLowerCase()}`}>{action.status.replaceAll("_", " ")}</span><h3>{awaitingApproval ? "Waiting for operator approval" : outcome?.verification_status === "SUCCESS" ? "Recovery verified" : "Waiting for refreshed reverse-logistics data"}</h3><p>{awaitingApproval ? "No execution lifecycle has started yet." : "When the return/RTO exception clears, Actnivo marks this action verified."}</p><dl><div><dt>Estimated protected</dt><dd>{currency.format(Number(outcome?.estimated_value_protected ?? 0))}</dd></div><div><dt>Actual protected</dt><dd>{outcome?.actual_value_protected == null ? "Pending" : currency.format(Number(outcome.actual_value_protected))}</dd></div></dl><Link href={`/app/returns-rto/${String(payload.return_id)}`}>View return/RTO →</Link></aside></div>
  </div>;

  if (isOrderRecovery) return <div className="product-page action-detail-page">
    <header className="product-page-header"><div><p>ACTIONS / ASSISTED</p><h1>{awaitingApproval ? "Proposed order recovery" : "Order recovery task"}</h1><span>{String(payload.external_order_id ?? "Order")} · {String(payload.issue_type ?? "Order exception").replaceAll("_", " ")}</span></div><Link href="/app/actions">← All actions</Link></header>
    {query.error && <p className="product-alert error">{query.error}</p>}{query.approved && <p className="product-alert success">Approved. The internal recovery task is ready for your operations team.</p>}
    <section className="assisted-banner"><span>{awaitingApproval ? "ORDER INTELLIGENCE PROPOSAL" : "ASSISTED EXECUTION"}</span><h2>{awaitingApproval ? "Review before approval." : "No customer, carrier, OMS, or marketplace action was performed."}</h2><p>{awaitingApproval ? "The proposal comes from deterministic order-exception logic. Approval creates an internal operator task only." : "Complete the task in your operational system. Actnivo verifies recovery when refreshed order data no longer has the exception."}</p>{awaitingApproval && <ApprovalPanel actionId={action.id} manageable={manageable} />}</section>
    <div className="action-detail-grid"><section><small>INTERNAL TASK</small><h2>{String(payload.internal_task ?? "Review and recover the affected order.")}</h2><div className="action-quantity"><span>ORDER<strong>{String(payload.external_order_id ?? "—")}</strong></span><span>PAYMENT<strong>{String(payload.payment_method ?? "—")}</strong></span><span>DELIVERY ATTEMPTS<strong>{Number(payload.delivery_attempts ?? 0)}</strong></span></div></section><aside><small>{awaitingApproval ? "PROPOSAL STATUS" : "VERIFICATION"}</small><span className={`action-state ${action.status.toLowerCase()}`}>{action.status.replaceAll("_", " ")}</span><h3>{awaitingApproval ? "Waiting for operator approval" : outcome?.verification_status === "SUCCESS" ? "Order recovery verified" : "Waiting for refreshed order data"}</h3><p>{awaitingApproval ? "No execution lifecycle has started yet." : "When the order exception clears, Actnivo marks the action verified from deterministic order state."}</p><dl><div><dt>Estimated protected</dt><dd>{currency.format(Number(outcome?.estimated_value_protected ?? 0))}</dd></div><div><dt>Actual protected</dt><dd>{outcome?.actual_value_protected == null ? "Pending" : currency.format(Number(outcome.actual_value_protected))}</dd></div></dl><Link href={`/app/orders/${String(payload.order_id)}`}>View order →</Link></aside></div>
  </div>;

  if (isExpedite) return <div className="product-page action-detail-page">
    <header className="product-page-header"><div><p>ACTIONS / ASSISTED</p><h1>{awaitingApproval ? "Proposed PO expedite" : "Expedite purchase order"}</h1><span>{String(payload.po_number)} · {String(payload.supplier_name)}</span></div><Link href="/app/actions">← All actions</Link></header>
    {query.error && <p className="product-alert error">{query.error}</p>}{query.approved && <p className="product-alert success">Approved. The supplier-ready request is prepared for your team.</p>}
    {preparedByCopilot && awaitingApproval && <section className="assisted-banner"><span>COPILOT PROPOSAL</span><h2>Review before approval.</h2><p>AI Copilot selected this action only from Actnivo's deterministic recommendation. Nothing has been sent to the supplier.</p><ApprovalPanel actionId={action.id} manageable={manageable} /></section>}
    {!preparedByCopilot && awaitingApproval && <section className="assisted-banner"><span>PROPOSED ACTION</span><h2>Review before approval.</h2><p>Nothing has been sent to the supplier.</p><ApprovalPanel actionId={action.id} manageable={manageable} /></section>}
    {!awaitingApproval && <section className="assisted-banner"><span>ASSISTED EXECUTION</span><h2>No supplier API, email, or marketplace action was sent.</h2><p>Actnivo prepared the request and internal task. Your operator remains responsible for contacting the supplier until a real connector is enabled.</p></section>}
    <div className="action-detail-grid"><section><small>INTERNAL TASK</small><h2>{String(payload.internal_task)}</h2><div className="product-card compact" style={{ marginTop: 16 }}><small>SUPPLIER-READY REQUEST</small><p style={{ whiteSpace: "pre-wrap" }}>{String(payload.supplier_request ?? "")}</p></div></section><aside><small>{awaitingApproval ? "PROPOSAL STATUS" : "VERIFICATION"}</small><span className={`action-state ${action.status.toLowerCase()}`}>{action.status.replaceAll("_", " ")}</span><h3>{awaitingApproval ? "Waiting for operator approval" : outcome?.verification_status === "SUCCESS" ? "Expedite outcome verified" : "Waiting for receipt data"}</h3><p>Actnivo does not claim supplier contact without a real connector.</p><Link href={`/app/purchase-orders/${String(payload.purchase_order_id)}`}>View purchase order →</Link></aside></div>
  </div>;

  if (isReplenishment) return <div className="product-page action-detail-page">
    <header className="product-page-header"><div><p>ACTIONS / ASSISTED</p><h1>{awaitingApproval ? "Proposed replenishment" : "Replenishment plan"}</h1><span>{String(payload.master_sku)} · {String(payload.destination_location)}</span></div><Link href="/app/actions">← All actions</Link></header>
    {query.error && <p className="product-alert error">{query.error}</p>}{query.approved && <p className="product-alert success">Approved. The internal replenishment task is ready.</p>}
    <section className="assisted-banner"><span>{awaitingApproval ? "PROPOSED ACTION" : "ASSISTED EXECUTION"}</span><h2>{awaitingApproval ? "Review before approval." : "No supplier or ERP order was created."}</h2><p>{awaitingApproval ? "This proposal is based on deterministic stockout logic." : "Use the internal task in your procurement workflow and upload fresh data for verification."}</p>{awaitingApproval && <ApprovalPanel actionId={action.id} manageable={manageable} />}</section>
    <div className="action-detail-grid"><section><small>INTERNAL TASK</small><h2>{String(payload.internal_task)}</h2><div className="action-quantity"><span>DESTINATION<strong>{String(payload.destination_location)}</strong></span><span>QUANTITY<strong>{Number(payload.quantity ?? 0).toLocaleString("en-IN")} units</strong></span></div></section><aside><small>VERIFICATION</small><span className={`action-state ${action.status.toLowerCase()}`}>{action.status.replaceAll("_", " ")}</span><h3>{outcome?.verification_status === "SUCCESS" ? "Replenishment verified" : "Waiting for fresh supply data"}</h3><p>Actnivo never claims a PO or supplier request was created without a real connector.</p></aside></div>
  </div>;

  return <div className="product-page action-detail-page"><header className="product-page-header"><div><p>ACTIONS / {action.execution_mode}</p><h1>{awaitingApproval ? "Proposed transfer plan" : "Transfer plan"}</h1><span>{String(payload.master_sku)} · created {new Date(action.created_at).toLocaleString("en-IN")}</span></div><Link href="/app/actions">← All actions</Link></header>
    {query.error && <p className="product-alert error">{query.error}</p>}{query.approved && <p className="product-alert success">Approved. The assisted execution artifact and internal task are ready.</p>}
    <section className="assisted-banner"><span>{awaitingApproval ? "PROPOSED ACTION" : "ASSISTED EXECUTION"}</span><h2>{awaitingApproval ? "Review before approval." : "No marketplace API was called."}</h2><p>{awaitingApproval ? "The transfer quantity and source location come from Actnivo's safe-rebalance engine." : "Complete the movement in your warehouse workflow, then upload a fresh inventory snapshot for verification."}</p>{awaitingApproval && <ApprovalPanel actionId={action.id} manageable={manageable} />}</section>
    <div className="action-detail-grid"><section><small>INTERNAL TASK</small><h2>{String(payload.internal_task)}</h2><div className="transfer-route"><div><small>FROM</small><strong>{String(payload.source_location)}</strong></div><span>→</span><div><small>TO</small><strong>{String(payload.destination_location)}</strong></div></div><div className="action-quantity"><span>QUANTITY<strong>{Number(payload.quantity ?? 0).toLocaleString("en-IN")} units</strong></span><span>EXPECTED INVENTORY<strong>{Number(payload.before_quantity ?? 0)} → {Number(payload.expected_quantity ?? 0)}</strong></span></div>{!awaitingApproval && <a className="saas-primary" href={`/app/actions/${action.id}/transfer.csv`}>Download transfer CSV</a>}</section><aside><small>VERIFICATION</small><span className={`action-state ${action.status.toLowerCase()}`}>{action.status.replaceAll("_", " ")}</span><h3>{outcome?.verification_status === "SUCCESS" ? "Outcome verified" : "Waiting for a new inventory import"}</h3><p>Actnivo compares the next destination snapshot with the expected state.</p></aside></div>
  </div>;
}
