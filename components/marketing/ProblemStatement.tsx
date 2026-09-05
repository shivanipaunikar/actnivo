import { Reveal } from "../motion/Reveal";
import { Stagger, StaggerItem } from "../motion/Stagger";

const examples = [
  ["Stockout detected", "Blinkit Bangalore inventory will run out tomorrow."],
  ["Revenue impact", "₹28,400 revenue at risk."],
  ["Recommended action", "Move 70 units Mumbai → Bangalore."],
];

export function ProblemStatement() {
  return <section className="marketing-section problem-positioning">
    <div className="section-shell">
      <Reveal>
        <p className="marketing-eyebrow">WHY ACTNIVO</p>
        <div className="problem-copy">
          <p className="problem-lead">Most commerce software tells you<br/>what happened.</p>
          <span className="problem-arrow" aria-hidden="true">→</span>
          <div className="problem-answer"><h2>Actnivo <span>fixes it.</span></h2><p>By telling you what needs to happen next.</p></div>
        </div>
      </Reveal>
      <Stagger className="problem-examples">
        {examples.map(([title, detail], index) => <StaggerItem className="problem-example" key={title}><small>0{index + 1}</small><div><b>{title}</b><p>{detail}</p></div></StaggerItem>)}
      </Stagger>
    </div>
  </section>;
}
