import { Reveal } from "../motion/Reveal";

const steps = [
  ["01","Stockout detected","Signal"],
  ["02","₹28,400 at risk","Impact"],
  ["03","Policy checked","Control"],
  ["04","Under ₹10K threshold","Rule"],
  ["05","Auto approved","Action"],
  ["06","Executed","Status"],
  ["07","Verified ✓","Outcome"],
];

export function AutopilotSpotlight(){return <section className="autopilot-spotlight" id="autopilot"><div className="section-shell spotlight-layout"><Reveal><p className="marketing-eyebrow light">SPOTLIGHT</p><h2>ACTNIVO<br/><span>AUTOPILOT</span></h2><p>Automate the operations you trust.<br/>Keep approval over everything else.</p></Reveal><div className="autopilot-flow">{steps.map(([number,title,label],index)=><Reveal variant="slideLeft" className={`autopilot-flow-step ${index>3?"active":""}`} key={number}><span>{number}</span><small>{label}</small><b>{title}</b>{index<steps.length-1&&<i>↓</i>}</Reveal>)}</div></div></section>}
