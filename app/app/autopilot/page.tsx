import Link from "next/link";
import { requireAppContext } from "@/lib/auth/session";
import { canManageInventory } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { runAutopilotNow, updateAutopilotPolicy } from "./actions";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const labels: Record<string, { title: string; description: string }> = {
  INVENTORY_TRANSFER: { title: "Inventory transfer", description: "Prepare a safe rebalance when deterministic stockout risk and source-coverage rules are satisfied." },
  REPLENISHMENT: { title: "Replenishment", description: "Prepare replenishment when stockout risk is high and there is no safe transfer source." },
  PO_EXPEDITE: { title: "PO expedite", description: "Prepare an expedite request when inbound supply arrives after projected stockout." },
  ORDER_RECOVERY: { title: "Order recovery", description: "Prepare assisted recovery for delayed, stuck, or COD/RTO-risk orders." },
  RETURN_RECOVERY: { title: "Returns & RTO recovery", description: "Prepare refund, pickup, reverse-transit, or RTO recovery tasks." },
};

export default async function AutopilotPage({ searchParams }: { searchParams: Promise<{ saved?: string; run?: string; scanned?: string; eligible?: string; prepared?: string; capped?: string; error?: string }> }) {
  const [query, context] = await Promise.all([searchParams, requireAppContext()]);
  const supabase = await createClient();
  const db = supabase as any;
  const [policiesResult, runsResult, actionsResult] = await Promise.all([
    db.from("autopilot_policies").select("*").eq("organization_id", context.organization.id).order("workflow", { ascending: true }),
    db.from("autopilot_runs").select("*").eq("organization_id", context.organization.id).order("created_at", { ascending: false }).limit(10),
    db.from("actions").select("id,status,payload,created_at").eq("organization_id", context.organization.id).order("created_at", { ascending: false }).limit(100),
  ]);
  for (const result of [policiesResult, runsResult, actionsResult]) if (result.error) throw new Error(result.error.message);
  const policies = policiesResult.data ?? [];
  const runs = runsResult.data ?? [];
  const autopilotActions = (actionsResult.data ?? []).filter((action: any) => String(action.payload?.prepared_by ?? "") === "AUTOPILOT");
  const enabled = policies.filter((policy: any) => policy.enabled).length;
  const waiting = autopilotActions.filter((action: any) => action.status === "AWAITING_APPROVAL").length;
  const manageable = canManageInventory(context.role);

  return <div className="product-page autopilot-page">
    <header className="product-page-header"><div><p>AUTOMATION</p><h1>Autopilot</h1><span>Policy-based action preparation with deterministic guardrails and a full audit trail.</span></div>{manageable && <form action={runAutopilotNow}><button className="saas-primary" type="submit">Run Autopilot now</button></form>}</header>
    {query.saved && <p className="product-alert success">Autopilot policy saved.</p>}
    {query.run && <p className="product-alert success">Autopilot scanned {query.scanned ?? 0} active issues, found {query.eligible ?? 0} eligible, and prepared {query.prepared ?? 0} action(s){Number(query.capped ?? 0) ? `; ${query.capped} were blocked by daily caps` : ""}.</p>}
    {query.error && <p className="product-alert error">{query.error}</p>}

    <section className="saas-metrics">
      <article><small>ENABLED POLICIES</small><strong>{enabled}/{policies.length}</strong><p>Workflow classes currently active</p></article>
      <article><small>AUTOPILOT ACTIONS</small><strong>{autopilotActions.length}</strong><p>Prepared from policy decisions</p></article>
      <article><small>WAITING APPROVAL</small><strong>{waiting}</strong><p>No external execution occurs before approval</p></article>
      <article><small>EXTERNAL EXECUTION</small><strong>OFF</strong><p>Locked until a real connector supports it</p></article>
      <article><small>LAST RUN</small><strong>{runs[0] ? new Date(runs[0].created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}</strong><p>{runs[0] ? `${runs[0].prepared_actions} action(s) prepared` : "No policy scan yet"}</p></article>
    </section>

    <section className="product-card" style={{ marginTop: 16 }}><header><div><small>POLICY ENGINE</small><h2>Automation boundaries</h2><p>Every workflow is disabled by default. Enable only the policies you want Actnivo to evaluate.</p></div></header>
      <div style={{ display: "grid", gap: 16, padding: 20 }}>
        {policies.map((policy: any) => {
          const copy = labels[policy.workflow] ?? { title: policy.workflow, description: "Policy-based action preparation." };
          return <form key={policy.id} action={updateAutopilotPolicy} className="product-card compact" style={{ padding: 18 }}>
            <input type="hidden" name="policy_id" value={policy.id} />
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}><div><small>{policy.workflow.replaceAll("_", " ")}</small><h3>{copy.title}</h3><p>{copy.description}</p></div><label style={{ display: "flex", gap: 8, alignItems: "center", whiteSpace: "nowrap" }}><input type="checkbox" name="enabled" defaultChecked={policy.enabled} /> Enabled</label></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12, marginTop: 16 }}>
              <label>Minimum ₹ at risk<input name="minimum_revenue_at_risk" type="number" min="0" step="100" defaultValue={Number(policy.minimum_revenue_at_risk)} /></label>
              <label>Minimum confidence %<input name="minimum_confidence_pct" type="number" min="0" max="100" step="1" defaultValue={Math.round(Number(policy.minimum_confidence) * 100)} /></label>
              <label>Daily action cap<input name="daily_action_cap" type="number" min="1" max="1000" step="1" defaultValue={policy.daily_action_cap} /></label>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginTop: 16, alignItems: "center" }}><small>Approval required · External execution disabled</small>{manageable && <button type="submit">Save policy</button>}</div>
          </form>;
        })}
      </div>
    </section>

    <div className="issue-detail-grid" style={{ marginTop: 16 }}>
      <section className="product-card"><header><div><small>RECENT RUNS</small><h2>Policy decisions</h2></div></header>{runs.length ? <div className="simple-table"><div className="simple-table-head"><span>Run</span><span>Scanned</span><span>Eligible</span><span>Prepared</span><span>Capped</span></div>{runs.map((run: any) => <div key={run.id}><span><strong>{new Date(run.created_at).toLocaleString("en-IN")}</strong></span><span>{run.scanned_issues}</span><span>{run.eligible_issues}</span><span>{run.prepared_actions}</span><span>{run.skipped_daily_cap}</span></div>)}</div> : <div className="product-empty"><span>◉</span><h3>No Autopilot runs yet.</h3><p>Enable at least one policy, then run Autopilot.</p></div>}</section>
      <aside className="product-card" style={{ padding: 20 }}><small>SAFETY MODEL</small><h2>Preparation first. Execution later.</h2><p>Autopilot evaluates deterministic Actnivo issues. Eligible cases become assisted actions waiting for approval.</p><p><strong>External execution remains locked.</strong> Actnivo will not contact a supplier, customer, carrier, marketplace, OMS, or ERP until a real integration and explicit execution policy exist.</p><Link href="/app/actions">Review prepared actions →</Link><br/><Link href="/app/ops">Review source issues →</Link></aside>
    </div>
  </div>;
}
