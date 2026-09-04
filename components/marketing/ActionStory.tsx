"use client";

import { motion, MotionValue, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

const stages = [
  { n:"01", name:"Detect", title:"Blinkit stockout detected.", detail:"Vitamin C Serum will run out in Bangalore within 1.4 days.", tag:"PROBLEM FOUND" },
  { n:"02", name:"Diagnose", title:"Demand increased 37%.", detail:"A campaign spike is pulling forward three days of forecast demand.", tag:"CAUSE EXPLAINED" },
  { n:"03", name:"Execute", title:"Move 70 units from Mumbai.", detail:"The safest transfer protects sales without creating a second stockout.", tag:"ACTION CREATED" },
  { n:"04", name:"Verify", title:"₹28,400 protected.", detail:"The transfer arrived and Blinkit availability is back above policy.", tag:"OUTCOME VERIFIED" },
];

function ProgressStage({ stage, index, progress }: { stage: typeof stages[number]; index: number; progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [Math.max(0,index*.25-.1),index*.25,Math.min(1,(index+1)*.25)], [.25,1,.25]);
  return <motion.div style={{ opacity }}><span>{stage.n}</span><b>{stage.name}</b></motion.div>;
}

function StoryCard({ stage, index, progress }: { stage: typeof stages[number]; index: number; progress: MotionValue<number> }) {
  const stops = [Math.max(0,index*.25-.08),index*.25,Math.min(1,(index+1)*.25)];
  const opacity = useTransform(progress, stops, [0,1,0]);
  const y = useTransform(progress, stops, [28,0,-18]);
  return <motion.article style={{ opacity, y }}><small>{stage.tag}</small><h3>{stage.title}</h3><p>{stage.detail}</p><div className="story-ui"><span>{stage.n}</span><div><i/><i/><i/></div><em>{index === 3 ? "✓" : "→"}</em></div></motion.article>;
}

export function ActionStory() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset:["start start","end end"] });
  return <section className="story-section" ref={ref} id="product"><div className="story-sticky"><div className="story-intro"><p>Most software tells you<br/>what went wrong.</p><h2>Actnivo <span>fixes it.</span></h2></div><div className="story-layout"><div className="story-progress"><motion.i style={{ scaleY: scrollYProgress }}/>{stages.map((stage,index)=><ProgressStage stage={stage} index={index} progress={scrollYProgress} key={stage.name}/>)}</div><div className="story-cards">{stages.map((stage,index)=><StoryCard stage={stage} index={index} progress={scrollYProgress} key={stage.name}/>)}</div></div></div></section>;
}
