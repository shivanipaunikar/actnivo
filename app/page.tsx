"use client";

import { useMemo, useState } from "react";

type ActionState = "pending" | "executing" | "done";

const nav = [
  ["⌂", "Command center"],
  ["◎", "AI actions", "6"],
  ["▦", "Orders"],
  ["◇", "Inventory"],
  ["⇄", "Channels"],
  ["▱", "Warehouses"],
  ["↩", "Returns & RTO"],
  ["◉", "Reports"],
] as const;

const channels = [
  { name: "Shopify", sales: "₹4.26L", orders: 812, share: 68, color: "#6c5ce7", delta: "+18.2%" },
  { name: "Amazon", sales: "₹2.18L", orders: 436, share: 48, color: "#ff9900", delta: "+6.4%" },
  { name: "Blinkit", sales: "₹1.44L", orders: 389, share: 38, color: "#f6c344", delta: "+24.1%" },
  { name: "Flipkart", sales: "₹92.6K", orders: 206, share: 28, color: "#2874f0", delta: "−3.8%" },
] as const;

const trend = [34, 31, 42, 36, 48, 44, 55, 52, 63, 58, 74, 67, 82, 77, 88, 92, 85, 96];

const initialActions = [
  {
    id: 1,
    severity: "critical",
    eyebrow: "STOCKOUT · BLINKIT DELHI",
    title: "Cocoa Protein Bars will stock out in 14 hours",
    detail: "Demand is 2.4× the 7-day average after a creator campaign. 186 units remain across two dark stores.",
    impact: "₹1.82L",
    impactLabel: "revenue at risk",
    action: "Transfer 420 units from Gurgaon WH to Blinkit Delhi",
    eta: "Arrival in 3h 20m",
  },
  {
    id: 2,
    severity: "warning",
    eyebrow: "INVENTORY MISMATCH · AMAZON",
    title: "Amazon reports 312 fewer units than your WMS",
    detail: "The mismatch began after GRN #AMZ-8842 yesterday. 7 SKUs are affected and 2 listings are suppressed.",
    impact: "₹64.8K",
    impactLabel: "daily GMV blocked",
    action: "Submit reconciliation with warehouse proof",
    eta: "Resolution in ~6h",
  },
] as const;

function TinyBars() {
  return (
    <div className="tiny-bars" aria-label="Sales trending upward">
      {trend.map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}
    </div>
  );
}

export default function Home() {
  const [activeNav, setActiveNav] = useState("Command center");
  const [range, setRange] = useState("Today");
  const [showChannels, setShowChannels] = useState(false);
  const [actionStates, setActionStates] = useState<Record<number, ActionState>>({ 1: "pending", 2: "pending" });
  const [notice, setNotice] = useState("9 of 11 sources synced · 2 need attention");

  const pending = useMemo(
    () => Object.values(actionStates).filter((state) => state === "pending").length + 4,
    [actionStates],
  );

  function approve(id: number) {
    setActionStates((current) => ({ ...current, [id]: "executing" }));
    setNotice(`Action ${id === 1 ? "#A-1042" : "#A-1043"} approved. Actnivo is executing it now.`);
    window.setTimeout(() => {
      setActionStates((current) => ({ ...current, [id]: "done" }));
      setNotice(id === 1 ? "Transfer created and acknowledged by Blinkit. Verification scheduled for 14:30." : "Reconciliation submitted to Amazon with 3 supporting documents.");
    }, 1400);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">A</span><span>actnivo</span></div>
        <p className="workspace-label">WORKSPACE</p>
        <button className="workspace"><span className="store-avatar">N</span><span><b>Nourish & Co.</b><small>India · D2C</small></span><span>⌄</span></button>
        <nav>
          {nav.map(([icon, label, badge]) => (
            <button key={label} className={activeNav === label ? "active" : ""} onClick={() => setActiveNav(label)}>
              <span className="nav-icon">{icon}</span><span>{label}</span>{badge && <em>{pending}</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="agent-status"><span className="pulse-dot"/><div><b>AI agent is watching</b><small>Last scan 2 min ago</small></div></div>
          <button><span className="nav-icon">⚙</span>Settings</button>
          <div className="profile"><span>SP</span><div><b>Shivani Paunikar</b><small>Founder</small></div><i>•••</i></div>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark">A</span>actnivo</div>
          <div className="sync"><span className="pulse-dot" /> Live operations</div>
          <div className="top-actions"><button aria-label="Search">⌕</button><button aria-label="Notifications" className="has-alert">♢</button><button className="range-button">4 Sep 2026</button></div>
        </header>

        <div className="dashboard">
          <div className="welcome-row">
            <div><p className="kicker">THURSDAY · 11:42 AM</p><h1>Good morning, Shivani.</h1><p>Here’s what needs your attention across the business.</p></div>
            <div className="range-tabs" aria-label="Date range">{["Today", "7 days", "30 days"].map((item) => <button key={item} onClick={() => setRange(item)} className={range === item ? "selected" : ""}>{item}</button>)}</div>
          </div>

          <button className="agent-strip" onClick={() => setNotice("All 11 connected sources will be rescanned in the next 2 minutes.")}>
            <span className="agent-spark">✦</span><span><b>Actnivo is monitoring your operations</b><small>{notice}</small></span><span className="strip-link">View connections →</span>
          </button>

          <div className="metric-grid">
            <article className="metric sales-card"><div className="metric-top"><span>TODAY'S SALES</span><span className="up">↗ 12.4%</span></div><div className="metric-main"><strong>₹9,84,260</strong><TinyBars /></div><p>₹8,75,940 at this time yesterday</p></article>
            <article className="metric"><div className="metric-top"><span>ORDERS TODAY</span><span className="up">↗ 8.7%</span></div><strong>1,843</strong><p>₹534 average order value</p></article>
            <article className="metric"><div className="metric-top"><span>INVENTORY VALUE</span><span>↗ 2.1%</span></div><strong>₹42.6L</strong><p>18,429 units · 286 SKUs</p></article>
            <article className="metric danger"><div className="metric-top"><span>REVENUE AT RISK</span><span>3 issues</span></div><strong>₹2.68L</strong><p>Action needed today</p></article>
            <article className="metric protected"><div className="metric-top"><span>REVENUE PROTECTED</span><span>THIS MONTH</span></div><strong>₹11.4L</strong><p>From 47 executed actions</p></article>
          </div>

          <div className="section-heading"><div><span className="alert-orb">!</span><h2>Needs your approval</h2><em>{pending}</em></div><button>View all →</button></div>
          <div className="action-list">
            {initialActions.map((item) => {
              const state = actionStates[item.id];
              return <article className={`action-card ${item.severity}`} key={item.id}>
                <div className="action-icon">{item.severity === "critical" ? "!" : "↯"}</div>
                <div className="action-copy"><p className="eyebrow">{item.eyebrow}</p><h3>{item.title}</h3><p>{item.detail}</p><div className="recommendation"><span>✦</span><div><b>Recommended action</b><p>{item.action}</p><small>{item.eta}</small></div></div></div>
                <div className="impact"><small>{item.impactLabel}</small><strong>{item.impact}</strong><span>if no action is taken</span></div>
                <div className="approve-area">
                  <button className={state === "done" ? "done" : "approve"} disabled={state !== "pending"} onClick={() => approve(item.id)}>{state === "pending" ? "Approve & execute" : state === "executing" ? "Executing…" : "✓ Executed"}</button>
                  <button className="details">Review details</button>
                </div>
              </article>;
            })}
          </div>

          <div className="lower-grid">
            <section className="panel channel-panel">
              <div className="panel-title"><div><h2>Channel performance</h2><p>Net sales today</p></div><button onClick={() => setShowChannels((value) => !value)}>{showChannels ? "Hide all" : "View all"} →</button></div>
              <div className="channel-list">
                {channels.map((channel) => <div className="channel-row" key={channel.name}><span className="channel-logo" style={{ background: channel.color }}>{channel.name.slice(0, 1)}</span><div className="channel-name"><b>{channel.name}</b><small>{channel.orders} orders</small></div><div className="bar"><i style={{ width: `${channel.share}%`, background: channel.color }} /></div><strong>{channel.sales}</strong><span className={channel.delta.startsWith("−") ? "down" : "up"}>{channel.delta}</span></div>)}
                {showChannels && <div className="extra-channels">Meesho · Myntra · AJIO · Zepto · Instamart · BigBasket · WooCommerce <button>+ Add custom</button></div>}
              </div>
            </section>

            <section className="panel health-panel">
              <div className="panel-title"><div><h2>Operations health</h2><p>Across inventory & fulfilment</p></div><span className="health-score">82 <small>/ 100</small></span></div>
              <div className="health-list">
                {["Stockouts predicted|8|danger", "Overstocked SKUs|23|warning", "Inventory mismatches|7|warning", "Purchase-order issues|4|danger", "Returns / RTO|8.2%|good"].map((row) => { const [label, value, tone] = row.split("|"); return <button key={label}><span className={`status-dot ${tone}`} /><span>{label}</span><b>{value}</b><i>›</i></button>; })}
              </div>
            </section>
          </div>

          <div className="lower-grid bottom-grid">
            <section className="panel warehouse-panel"><div className="panel-title"><div><h2>Warehouse performance</h2><p>Fulfilment SLAs today</p></div><button>View details →</button></div><div className="warehouses">{[["Gurgaon", "96%", "1,024", "Healthy"], ["Mumbai", "91%", "536", "Watch"], ["Bengaluru", "98%", "283", "Healthy"]].map((wh) => <div key={wh[0]}><span className="wh-icon">▣</span><p><b>{wh[0]}</b><small>{wh[2]} orders</small></p><strong>{wh[1]}</strong><em className={wh[3] === "Healthy" ? "healthy" : "watch"}>{wh[3]}</em></div>)}</div></section>
            <section className="panel quick-panel"><div className="panel-title"><div><h2>Quick-commerce pulse</h2><p>Availability across dark stores</p></div><span className="up">↗ 19.8%</span></div><div className="quick-stats"><div><small>Net sales</small><strong>₹2.31L</strong></div><div><small>Fill rate</small><strong>93.6%</strong></div><div><small>Dark stores</small><strong>48</strong></div></div><div className="quick-line"><span>Blinkit</span><i><b style={{ width: "94%" }}/></i><em>94%</em></div><div className="quick-line"><span>Zepto</span><i><b style={{ width: "88%" }}/></i><em>88%</em></div><div className="quick-line"><span>Instamart</span><i><b style={{ width: "97%" }}/></i><em>97%</em></div></section>
          </div>

          <section className="activity"><div className="panel-title"><div><h2>Recently executed by Actnivo</h2><p>Actions verified after execution</p></div><button>View action log →</button></div><div className="activity-row"><span className="check">✓</span><p><b>Rebalanced 280 units of Collagen Mix to Mumbai WH</b><small>Executed at 10:28 · Verified: Amazon availability restored</small></p><strong>₹38.4K protected</strong><em>VERIFIED</em></div><div className="activity-row"><span className="check">✓</span><p><b>Paused overspending Flipkart campaign for 3 SKUs</b><small>Executed at 09:51 · Verified: ROAS recovered to 2.8×</small></p><strong>₹12.7K saved</strong><em>VERIFIED</em></div></section>
        </div>
      </section>
    </main>
  );
}
