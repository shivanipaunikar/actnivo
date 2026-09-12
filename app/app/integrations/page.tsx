import Link from "next/link";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getRecentImportJobs } from "@/lib/data/imports";
import { StatusBadge } from "@/components/app/StatusBadge";

export default async function IntegrationsPage() {
  const { organization } = await requireAppContext();
  const supabase = await createClient();
  const jobs = await getRecentImportJobs(supabase, organization.id, 5);
  return (
    <div className="product-page">
      <header className="product-page-header"><div><p>PLATFORM</p><h1>Integrations</h1><span>Bring operational data into {organization.name} securely.</span></div><Link className="saas-primary" href="/app/integrations/import">Upload data</Link></header>
      <section className="integration-source-grid">
        <article><small>AVAILABLE NOW</small><strong>File import</strong><p>Upload inventory and daily sales in CSV or XLSX format. Map fields before anything is written to your commerce model.</p><Link href="/app/integrations/import">Start an import →</Link></article>
        <article className="muted"><small>EARLY ACCESS</small><strong>Direct channel connections</strong><p>Marketplace and OMS API connections are intentionally not active in this sprint.</p></article>
      </section>
      <section className="product-card"><header><div><small>IMPORT HISTORY</small><h2>Recent files</h2></div></header>{jobs.length ? <div className="simple-table"><div className="simple-table-head"><span>File</span><span>Type</span><span>Rows</span><span>Status</span><span /></div>{jobs.map((job) => <div key={job.id}><span><strong>{job.filename}</strong><small>{new Date(job.created_at).toLocaleString("en-IN")}</small></span><span>{job.source_type}</span><span>{job.total_rows.toLocaleString("en-IN")}</span><StatusBadge status={job.status} /><Link href={`/app/integrations/import/${job.id}`}>Open →</Link></div>)}</div> : <div className="product-empty"><span>⇧</span><h3>No files imported yet.</h3><p>Your original source files and import history will appear here.</p></div>}</section>
    </div>
  );
}
