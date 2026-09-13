import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const sections: Record<string, { eyebrow: string; title: string; description: string }> = {
  ops: { eyebrow: "OPERATIONS", title: "Ops Inbox", description: "Prioritized operational issues will appear here after data is connected." },
  inventory: { eyebrow: "OPERATIONS", title: "Inventory", description: "Inventory intelligence is planned for Early Access and is not active yet." },
  orders: { eyebrow: "OPERATIONS", title: "Orders", description: "Unified order monitoring is coming in a future product phase." },
  "returns-rto": { eyebrow: "OPERATIONS", title: "Returns & RTO", description: "Returns and RTO intelligence is planned for Early Access." },
  actions: { eyebrow: "AUTOMATION", title: "Actions", description: "Execution workflows are not active yet. No automated action will run in this release." },
  autopilot: { eyebrow: "AUTOMATION", title: "Autopilot", description: "Policy-based automation is planned for a later phase." },
  "ai-copilot": { eyebrow: "AUTOMATION", title: "AI Copilot", description: "AI functionality is intentionally not implemented in this phase." },
  analytics: { eyebrow: "INTELLIGENCE", title: "Analytics", description: "Analytics will populate after operational sources are connected." },
  profitability: { eyebrow: "INTELLIGENCE", title: "Profitability", description: "Profitability analysis is planned for Early Access." },
  "value-generated": { eyebrow: "INTELLIGENCE", title: "Value Generated", description: "Verified value will be tracked once action execution is available." },
  integrations: { eyebrow: "PLATFORM", title: "Integrations", description: "Secure channel connection flows are the next implementation phase." },
  team: { eyebrow: "PLATFORM", title: "Team", description: "Team invitations and role management are coming next." },
  settings: { eyebrow: "PLATFORM", title: "Settings", description: "Workspace settings are available to Early Access organizations soon." },
};

async function PurchaseOrdersWorkspace() {
  const { organization } = await requireAppContext();
  const supabase = await createClient();
  const db = supabase as any;
  const [poResult, lineResult] = await Promise.all([
    db.from("purchase_orders").select("*").eq("organization_id", organization.id).order("expected_delivery_date", { ascending: true }),
    db.from("purchase_order_lines").select("*").eq("organization_id", organization.id),
  ]);
  if (poResult.error) throw new Error(poResult.error.message);
  if (lineResult.error) throw new Error(lineResult.error.message);
  const purchaseOrders = poResult.data ?? [];
  const lines = lineResult.data ?? [];
  const active = purchaseOrders.filter((po: any) => !["RECEIVED", "CANCELLED"].includes(po.status));
  const late = purchaseOrders.filter((po: any) => po.status === "LATE");
  const inbound = lines.reduce((sum: number, line: any) => sum + Math.max(0, Number(line.confirmed_quantity ?? line.ordered_quantity) - Number(line.received_quantity ?? 0)), 0);
  const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
  const value = active.reduce((sum: number, po: any) => sum + Number(po.total_value ?? 0), 0);
  return <div className="product-page"><header className="product-page-header"><div><p>OPERATIONS / SUPPLY</p><h1>Purchase Orders</h1><span>Incoming supply intelligence across connected commerce systems.</span></div><Link href="/app/integrations">Connect supply data →</Link></header><section className="saas-metrics"><article><small>OPEN POS</small><strong>{active.length}</strong><p>Active inbound orders</p></article><article><small>PO VALUE</small><strong>{money.format(value)}</strong><p>Open purchase value</p></article><article><small>LATE POS</small><strong>{late.length}</strong><p>Past expected arrival</p></article><article><small>INBOUND UNITS</small><strong>{inbound.toLocaleString("en-IN")}</strong><p>Remaining confirmed supply</p></article><article><small>ARCHITECTURE</small><strong>API-first</strong><p>Source-agnostic normalized model</p></article></section><section className="product-card" style={{ marginTop: 16 }}><header><div><small>INCOMING SUPPLY</small><h2>Purchase order health</h2></div></header>{purchaseOrders.length ? <div className="simple-table"><div className="simple-table-head"><span>PO</span><span>Supplier</span><span>Arrival</span><span>Status</span><span>Value</span></div>{purchaseOrders.map((po: any) => <div key={po.id}><span><strong>{po.external_po_number}</strong><small>{po.source_type}</small></span><span>{po.supplier_name}</span><span>{new Date(`${po.expected_delivery_date}T00:00:00Z`).toLocaleDateString("en-IN")}</span><span>{po.status.replaceAll("_", " ")}</span><span>{money.format(Number(po.total_value ?? 0))}</span></div>)}</div> : <div className="product-empty"><span>▱</span><h3>No purchase orders connected yet.</h3><p>Connect an ERP, OMS, supplier API, or use the file adapter for onboarding and historical backfills.</p></div>}</section></div>;
}

export default async function EarlyAccessPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (section === "purchase-orders") return <PurchaseOrdersWorkspace />;
  const content = sections[section];
  if (!content) notFound();
  return <div className="saas-placeholder"><p>{content.eyebrow}</p><span>EARLY ACCESS</span><h1>{content.title}</h1><div><i>✦</i><h2>This workspace is ready for the next phase.</h2><p>{content.description}</p><Link href="/app/dashboard">Return to dashboard →</Link></div></div>;
}
