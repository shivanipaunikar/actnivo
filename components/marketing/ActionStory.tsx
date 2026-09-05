"use client";

import dynamic from "next/dynamic";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { useRef, useState } from "react";

const ScrollScene = dynamic(() => import("../three/ScrollScene").then(module => module.ScrollScene), { ssr:false, loading:() => <div className="scroll-scene-loading"/> });

const stages = [
  { n:"01", name:"Detect", title:"Blinkit stockout detected.", detail:"Vitamin C Serum · Bangalore", metric:"43 units remain", outcome:"A live operational signal becomes a prioritized issue." },
  { n:"02", name:"Predict", title:"Stockout in 1.4 days.", detail:"Demand velocity increased 37% above forecast.", metric:"₹28,400 at risk", outcome:"Actnivo calculates what happens next—and what it will cost." },
  { n:"03", name:"Act", title:"Move 70 units.", detail:"Mumbai → Bangalore", metric:"Best safe action", outcome:"The right inventory route activates for approval." },
  { n:"04", name:"Automate", title:"Transfer TR-83922 created.", detail:"Within approved automation policy.", metric:"Action executing", outcome:"Safe actions move without adding operational work." },
  { n:"05", name:"Verify", title:"Inventory restored.", detail:"Bangalore FC · 43 → 113 units", metric:"₹27,900 protected", outcome:"Actnivo verifies the result and records the value created." },
];

export function ActionStory() {
  const ref = useRef<HTMLElement>(null);
  const [active,setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target:ref, offset:["start start","end end"] });
  useMotionValueEvent(scrollYProgress,"change",value => setActive(Math.min(stages.length-1,Math.floor(value*stages.length))));
  const stage = stages[active];

  return <section className="story-section story-3d-section" ref={ref} id="product"><div className="story-3d-sticky section-shell">
    <div className="workflow-head"><p className="marketing-eyebrow">THE ACTNIVO WORKFLOW</p><h2>Detect. Predict. Act.<br/><span>Automate. Verify.</span></h2></div>
    <div className="story-3d-layout">
      <div className="story-scene-wrap"><ScrollScene phase={active}/><div className="story-depth-labels" aria-hidden="true"><span>DATA</span><span>INTELLIGENCE</span><span>ACTION</span></div></div>
      <div className="story-stage-panel">
        <div className="story-stage-nav">{stages.map((item,index)=><span className={index===active?"active":""} key={item.n}><small>{item.n}</small>{item.name}</span>)}</div>
        <AnimatePresence mode="wait"><motion.div className="story-stage-copy" key={stage.n} initial={{opacity:0,y:18,filter:"blur(5px)"}} animate={{opacity:1,y:0,filter:"blur(0px)"}} exit={{opacity:0,y:-12,filter:"blur(4px)"}} transition={{duration:.45}}><small>{stage.name.toUpperCase()}</small><h3>{stage.title}</h3><p>{stage.detail}</p><strong>{stage.metric}</strong><div><i/>{stage.outcome}</div></motion.div></AnimatePresence>
      </div>
    </div>
    <div className="story-scroll-progress"><motion.i style={{scaleX:scrollYProgress}}/><span>{active+1} / {stages.length}</span></div>
  </div>
  <div className="story-mobile-list section-shell">{stages.map(item=><article key={item.n}><small>{item.n} · {item.name}</small><h3>{item.title}</h3><p>{item.detail}</p><strong>{item.metric}</strong></article>)}</div>
  </section>;
}
