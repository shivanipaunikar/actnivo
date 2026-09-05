"use client";

import { useMotionValueEvent, useScroll } from "motion/react";
import type { CSSProperties } from "react";
import { useRef, useState } from "react";
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

export function AutopilotSpotlight(){
  const sectionRef = useRef<HTMLElement>(null);
  const [activeStep,setActiveStep] = useState(0);
  const { scrollYProgress } = useScroll({target:sectionRef,offset:["start center","end center"]});
  useMotionValueEvent(scrollYProgress,"change",value=>setActiveStep(Math.min(steps.length-1,Math.floor(value*steps.length))));

  return <section className="autopilot-spotlight" id="autopilot" ref={sectionRef}><div className="autopilot-sticky"><div className="section-shell spotlight-layout"><Reveal><p className="marketing-eyebrow light">SPOTLIGHT</p><h2>ACTNIVO<br/><span>AUTOPILOT</span></h2><p>Automate the operations you trust.<br/>Keep approval over everything else.</p></Reveal><div className="autopilot-pipeline" style={{"--pipeline-progress":activeStep/(steps.length-1)} as CSSProperties}>{steps.map(([number,title,label],index)=><div className={`pipeline-step ${index<activeStep?"complete":index===activeStep?"processing":"waiting"}`} key={number}><span><i/></span><small>{label}</small><b>{title}</b></div>)}</div></div></div></section>
}
