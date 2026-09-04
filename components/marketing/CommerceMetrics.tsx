import { Reveal } from "../motion/Reveal";
import { Stagger, StaggerItem } from "../motion/Stagger";

const capabilities = [["01","Predict","Stockouts before they happen"],["02","Prioritize","Every problem by ₹ impact"],["03","Execute","Actions directly from one place"],["04","Verify","Whether every action worked"]];

export function CommerceMetrics() { return <section className="marketing-section section-shell" id="solutions"><Reveal><p className="marketing-eyebrow">OPERATIONAL INTELLIGENCE</p><h2 className="section-title">Know what is costing you money<br/><span>before it becomes a problem.</span></h2></Reveal><Stagger className="capability-grid">{capabilities.map(([n,t,d])=><StaggerItem className="capability-card" key={t}><small>{n}</small><h3>{t}</h3><p>{d}</p><span>↗</span></StaggerItem>)}</Stagger></section>; }
