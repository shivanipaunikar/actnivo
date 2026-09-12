import Link from "next/link";
import { notFound } from "next/navigation";

const sections: Record<string, { eyebrow: string; title: string; description: string }> = {
  ops: { eyebrow: "OPERATIONS", title: "Ops Inbox", description: "Prioritized operational issues will appear here after data is connected." },
  inventory: { eyebrow: "OPERATIONS", title: "Inventory", description: "Inventory intelligence is planned for Early Access and is not active yet." },
  orders: { eyebrow: "OPERATIONS", title: "Orders", description: "Unified order monitoring is coming in a future product phase." },
  "purchase-orders": { eyebrow: "OPERATIONS", title: "Purchase Orders", description: "Purchase-order workflows are not enabled in this release." },
  "quick-commerce": { eyebrow: "OPERATIONS", title: "Quick Commerce", description: "Dark-store availability monitoring will activate after integrations launch." },
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

export default async function EarlyAccessPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const content = sections[section];
  if (!content) notFound();
  return <div className="saas-placeholder"><p>{content.eyebrow}</p><span>EARLY ACCESS</span><h1>{content.title}</h1><div><i>✦</i><h2>This workspace is ready for the next phase.</h2><p>{content.description}</p><Link href="/app/dashboard">Return to dashboard →</Link></div></div>;
}
