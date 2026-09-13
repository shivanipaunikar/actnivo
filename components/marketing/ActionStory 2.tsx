"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

const stages = [
  { n:"01", name:"Detect", title:"Blinkit stockout detected.", detail:"Vitamin C Serum will run out in Bangalore within 1.4 days.", tag:"PROBLEM FOUND" },
  { n:"02", name:"Diagnose", title:"Demand increased 37%.", detail:"A campaign spike is pulling forward three days of forecast demand.", tag:"CAUSE EXPLAINED" },
  { n:"03", name:"Execute", title:"Move 70 units from Mumbai.", detail:"The safest transfer protects sales without creating a second stockout.", tag:"ACTION CREATED" },
  { n:"04", name:"Verify", title:"₹28,400 protected.", detail:"The transfer arrived and Blinkit availability is back above policy.", tag:"OUTCOME VERIFIED" },
];

export function ActionStory() {
  const ref = useRef<HTMLElement>(null); const { scrollYProgress } = useScroll({ target: ref, offset:["start start","end end"] });
  return <section className="story-section" ref={ref} id="product"><div className="story-sticky"><div className="story-intro"><p>Most software tells you<br/>what went wrong.</p><h2>Actnivo <span>fixes it.</span></h2></div><div className="story-layout"><div className="story-progress"><motion.i style={{ scaleY: scrollYProgress }}/>{stages.map((s,i)=><motion.div key={s.name} style={{ opacity:useTransform(scrollYProgress,[Math.max(0,i*.25-.1),i*.25,(i+1)*.25],[.25,1,.25]) }}><span>{s.n}</span><b>{s.name}</b></motion.div>)}</div><div className="story-cards">{stages.map((s,i)=><motion.article key={s.name} style={{ opacity:useTransform(scrollYProgress,[Math.max(0,i*.25-.08),i*.25,Math.min(1,(i+1)*.25)],[0,1,0]), y:useTransform(scrollYProgress,[Math.max(0,i*.25-.08),i*.25,Math.min(1,(i+1)*.25)],[28,0,-18]) }}><small>{s.tag}</small><h3>{s.title}</h3><p>{s.detail}</p><div className="story-ui"><span>{s.n}</span><div><i/><i/><i/></div><em>{i === 3 ? "✓" : "→"}</em></div></motion.article>)}</div></div></div></section>;
}
