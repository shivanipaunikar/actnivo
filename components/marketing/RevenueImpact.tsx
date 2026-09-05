import { Reveal } from "../motion/Reveal";
import { Stagger, StaggerItem } from "../motion/Stagger";

const risks = [
  ["01", "Blinkit stockout", "₹28,400"],
  ["02", "Zepto PO shortage", "₹17,700"],
  ["03", "Amazon listing issue", "₹11,200"],
];

export function RevenueImpact() {
  return <section className="marketing-section revenue-impact" id="impact"><div className="section-shell impact-layout">
    <Reveal><p className="marketing-eyebrow">FINANCIAL PRIORITY</p><h2 className="section-title">Don’t prioritize alerts.<br/><span>Prioritize money.</span></h2><p className="section-copy">Actnivo ranks every operational problem by its financial impact, so your team always knows what is costing the most money right now.</p></Reveal>
    <Reveal variant="scale" className="impact-ledger"><div className="impact-total"><small>POTENTIAL REVENUE AT RISK</small><strong>₹74,300</strong><span>Across 8 open issues</span></div><Stagger className="impact-risks">{risks.map(([number,title,value])=><StaggerItem className="impact-risk" key={title}><small>{number}</small><b>{title}</b><strong>{value}</strong></StaggerItem>)}</Stagger><div className="impact-question">Tell me what is costing me the most money right now. <span>→</span></div></Reveal>
  </div></section>;
}
