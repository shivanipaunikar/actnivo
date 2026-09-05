import { Reveal } from "../motion/Reveal";
import { Stagger, StaggerItem } from "../motion/Stagger";

const stages = [
  { n:"01", title:"Blinkit stockout detected.", detail:"Vitamin C Serum · Bangalore", label:"STOCK REMAINING", value:"43 units", outcome:"Inventory will run out tomorrow.", tag:"DETECT · PROBLEM FOUND" },
  { n:"02", title:"Demand increased 37%.", detail:"Demand velocity is above the seven-day forecast.", label:"EXPECTED STOCKOUT", value:"1.4 days", outcome:"₹28,400 revenue at risk", tag:"DIAGNOSE · CAUSE EXPLAINED" },
  { n:"03", title:"Move 70 units.", detail:"Mumbai → Bangalore", label:"RECOMMENDED ACTION", value:"70 units", outcome:"Protect sales without creating a second stockout.", tag:"EXECUTE · ACTION READY", action:"Approve" },
  { n:"04", title:"Transfer completed.", detail:"Inventory increased at Bangalore FC.", label:"INVENTORY", value:"43 → 113 units", outcome:"₹28,400 protected", tag:"VERIFY · OUTCOME VERIFIED" },
];

export function ActionStory() {
  return <section className="marketing-section story-section" id="product"><div className="section-shell story-static">
    <Reveal className="workflow-head"><p className="marketing-eyebrow">THE ACTNIVO WORKFLOW</p><h2>Detect. Diagnose.<br/><span>Execute. Verify.</span></h2></Reveal>
    <Stagger className="story-cards story-cards-static">
      {stages.map((stage,index)=><StaggerItem className="story-card-static" key={stage.n}>
        <div className="story-card-head"><small>{stage.tag}</small><span>{stage.n} / 04</span></div>
        <h3>{stage.title}</h3><p>{stage.detail}</p>
        <div className="story-metric"><small>{stage.label}</small><strong>{stage.value}</strong></div>
        <div className={`story-outcome ${index === 1 ? "risk" : index === 3 ? "success" : ""}`}><i/>{stage.outcome}</div>
        {stage.action&&<button>{stage.action}<span>→</span></button>}
      </StaggerItem>)}
    </Stagger>
  </div></section>;
}
