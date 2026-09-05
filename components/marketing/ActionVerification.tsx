import { Reveal } from "../motion/Reveal";
import { Stagger, StaggerItem } from "../motion/Stagger";

const verification = [
  ["Detected", "43 units remaining", "01"],
  ["Recommended", "Transfer 70 units", "02"],
  ["Executed", "Transfer TR-83922 created", "03"],
  ["Verified", "Inventory 43 → 109", "04"],
  ["Outcome", "₹27,900 potential revenue protected", "05"],
];

export function ActionVerification() {
  return <section className="marketing-section verification-section"><div className="section-shell verification-layout"><Reveal><p className="marketing-eyebrow">ACTION VERIFICATION</p><h2 className="section-title">We don’t stop<br/><span>at “Done.”</span></h2><p className="section-copy">Actnivo verifies whether the action actually worked and learns from the result.</p></Reveal><Stagger className="verification-flow">{verification.map(([label,value,n],index)=><StaggerItem className={`verification-step step-${index+1}`} key={label}><span>{n}</span><div><small>{label}</small><strong>{value}</strong></div>{index<verification.length-1&&<i>↓</i>}</StaggerItem>)}</Stagger></div></section>;
}
