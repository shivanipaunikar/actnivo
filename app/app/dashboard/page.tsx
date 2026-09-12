import Link from "next/link";
import { requireAppContext } from "@/lib/auth/session";

const emptyMetrics = [
  ["TODAY’S SALES", "—"],
  ["ORDERS TODAY", "—"],
  ["INVENTORY VALUE", "—"],
  ["REVENUE AT RISK", "—"],
  ["REVENUE PROTECTED", "—"],
] as const;

export default async function AppDashboardPage() {
  const { user, organization } = await requireAppContext();
  const firstName = user.fullName.split(/\s+/)[0];
  return (
    <div className="saas-dashboard">
      <header className="saas-topbar"><span><i /> Workspace secure</span><Link href="/app/settings">Settings</Link></header>
      <div className="saas-page">
        <div className="saas-welcome"><div><p>COMMAND CENTER</p><h1>Welcome, {firstName}.</h1><span>{organization.name} · {organization.country}</span></div><time>{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date())}</time></div>
        <section className="saas-empty-hero">
          <span>01</span>
          <div><small>CONNECT YOUR OPERATIONS</small><h2>No data connected yet.</h2><p>Import a source or connect an integration to start building your unified commerce operations view.</p><div><Link className="saas-primary" href="/app/integrations">Import your first data source</Link><Link href="/app/integrations">Connect integration →</Link></div></div>
          <aside><i /><i /><i /><strong>Waiting for your first source</strong></aside>
        </section>
        <div className="saas-metrics" aria-label="Commerce metrics awaiting data">
          {emptyMetrics.map(([label, value]) => <article key={label}><small>{label}</small><strong>{value}</strong><p>No data connected</p></article>)}
        </div>
        <div className="saas-empty-grid">
          <section><header><div><small>OPS INBOX</small><h3>Issues that need attention</h3></div><span>0 open</span></header><div className="saas-empty-row"><i>✓</i><p><strong>You’re ready to connect.</strong><span>Operational issues will appear here after your first import.</span></p></div></section>
          <section><header><div><small>CHANNEL HEALTH</small><h3>Connected commerce channels</h3></div></header><div className="saas-channel-placeholder">Shopify <span /> Amazon <span /> Blinkit <span /> + more</div></section>
        </div>
      </div>
    </div>
  );
}
