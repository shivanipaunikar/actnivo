import { Reveal } from "../motion/Reveal";
import { Stagger, StaggerItem } from "../motion/Stagger";

const plans = [
  ["Starter", "For growing brands", "₹2,999", "2 channels · Core Ops Inbox"],
  ["Growth", "For multi-channel operations", "₹7,999", "6 channels · AI actions", "popular"],
  ["Pro", "For scaling D2C brands", "₹19,999", "Unlimited channels · Autopilot"],
];

export function PricingTeaser() {
  return <section className="marketing-section pricing-section" id="pricing"><div className="section-shell"><Reveal><p className="marketing-eyebrow">SIMPLE PRICING</p><div className="pricing-head"><h2 className="section-title">Start with visibility.<br/><span>Scale into autonomy.</span></h2><a href="mailto:hello@actnivo.com?subject=Actnivo pricing">View pricing <span>→</span></a></div></Reveal><Stagger className="pricing-grid">{plans.map(([name,description,price,feature,tone])=><StaggerItem className={`price-card ${tone??""}`} key={name}>{tone&&<em>RECOMMENDED</em>}<small>{name}</small><h3>{description}</h3><strong>{price}<span>/mo</span></strong><p>{feature}</p><a href="#start">Start Free <span>→</span></a></StaggerItem>)}</Stagger></div></section>;
}
