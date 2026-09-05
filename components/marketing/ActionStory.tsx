"use client";

import { motion, MotionValue, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

const stages = [
  { n:"01", name:"Detect", title:"Blinkit stockout detected.", detail:"Vitamin C Serum · Bangalore", label:"STOCK REMAINING", value:"43 units", outcome:"Inventory will run out tomorrow.", tag:"PROBLEM FOUND" },
  { n:"02", name:"Diagnose", title:"Demand increased 37%.", detail:"Demand velocity is above the seven-day forecast.", label:"EXPECTED STOCKOUT", value:"1.4 days", outcome:"₹28,400 revenue at risk", tag:"CAUSE EXPLAINED" },
  { n:"03", name:"Execute", title:"Move 70 units.", detail:"Mumbai → Bangalore", label:"RECOMMENDED ACTION", value:"70 units", outcome:"Protect sales without creating a second stockout.", tag:"ACTION READY", action:"Approve" },
  { n:"04", name:"Verify", title:"Transfer completed.", detail:"Inventory increased at Bangalore FC.", label:"INVENTORY", value:"43 → 113 units", outcome:"₹28,400 protected", tag:"OUTCOME VERIFIED" },
];

function ProgressStage({ stage, index, progress }: { stage: typeof stages[number]; index: number; progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [Math.max(0,index*.25-.1),index*.25,Math.min(1,(index+1)*.25)], [.25,1,.25]);
  return <motion.div style={{ opacity }}><span>{stage.n}</span><b>{stage.name}</b></motion.div>;
}

function StoryCard({ stage, index, progress }: { stage: typeof stages[number]; index: number; progress: MotionValue<number> }) {
  const stops = [Math.max(0,index*.25-.08),index*.25,Math.min(1,(index+1)*.25)];
  const opacity = useTransform(progress, stops, [0,1,0]);
  const y = useTransform(progress, stops, [28,0,-18]);
  return <motion.article layout style={{ opacity, y }}><div className="story-card-head"><small>{stage.tag}</small><span>{stage.n} / 04</span></div><h3>{stage.title}</h3><p>{stage.detail}</p><div className="story-metric"><small>{stage.label}</small><strong>{stage.value}</strong></div><div className={`story-outcome ${index === 1 ? "risk" : index === 3 ? "success" : ""}`}><i/>{stage.outcome}</div>{stage.action&&<button>{stage.action}<span>→</span></button>}</motion.article>;
}

export function ActionStory() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset:["start start","end end"] });
  return <section className="story-section" ref={ref} id="product"><div className="story-sticky"><div className="workflow-head"><p className="marketing-eyebrow">THE ACTNIVO WORKFLOW</p><h2>Detect. Diagnose.<br/><span>Execute. Verify.</span></h2></div><div className="story-layout"><div className="story-progress"><motion.i style={{ scaleY: scrollYProgress }}/>{stages.map((stage,index)=><ProgressStage stage={stage} index={index} progress={scrollYProgress} key={stage.name}/>)}</div><div className="story-cards">{stages.map((stage,index)=><StoryCard stage={stage} index={index} progress={scrollYProgress} key={stage.name}/>)}</div></div></div></section>;
}
