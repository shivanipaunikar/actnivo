"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Reveal } from "../motion/Reveal";

const stages = [
  { id:"detect", label:"DETECT", eyebrow:"OPS INBOX", title:"See what needs attention.", copy:"Every operational signal becomes a prioritized issue with its financial impact attached.", metric:"12 critical issues", value:"₹1.84L revenue at risk" },
  { id:"predict", label:"PREDICT", eyebrow:"STOCKOUT FORECAST", title:"Know what happens next.", copy:"Actnivo reads inventory and demand velocity before availability turns into lost sales.", metric:"Vitamin C Serum", value:"Stockout in 1.4 days" },
  { id:"act", label:"ACT", eyebrow:"RECOMMENDED ACTION", title:"Move 70 units.", copy:"The safest next action is calculated across every warehouse and channel.", metric:"Mumbai → Bangalore", value:"₹28,400 protected" },
  { id:"automate", label:"AUTOMATE", eyebrow:"POLICY ENGINE", title:"Set the boundary once.", copy:"Trusted operations execute automatically. Everything else waits for approval.", metric:"Replenishment under ₹10K", value:"AUTO APPROVE" },
  { id:"verify", label:"VERIFY", eyebrow:"OUTCOME VERIFIED", title:"Prove the action worked.", copy:"Expected and actual results are compared so the system learns from every decision.", metric:"43 → 113 expected", value:"109 actual · Successful" },
];

export function ActionPlatform() {
  const [active, setActive] = useState(0);
  const stage = stages[active];

  return <section className="action-platform" id="product"><div className="section-shell">
    <Reveal className="action-platform-head"><div><p className="marketing-eyebrow">THE ACTION PLATFORM</p><h2>Built for action.<br/><span>Intelligent by design.</span></h2></div><p>One continuous operating loop—from the first signal to the verified result.</p></Reveal>
    <div className="action-tabs" role="tablist" aria-label="Actnivo operating loop">{stages.map((item,index)=><button role="tab" aria-selected={index===active} className={index===active?"active":""} onClick={()=>setActive(index)} key={item.id}><span>0{index+1}</span>{item.label}</button>)}</div>
    <Reveal variant="scale" className="action-stage-shell"><AnimatePresence mode="wait"><motion.div className={`action-stage action-stage-${stage.id}`} key={stage.id} initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-12}} transition={{duration:.32}}>
      <div className="action-stage-copy"><small>{stage.eyebrow}</small><h3>{stage.title}</h3><p>{stage.copy}</p>{stage.id==="act"&&<button>Approve <span>→</span></button>}</div>
      <div className="action-stage-visual">
        <div className="stage-window-bar"><span>Actnivo operations</span><i>Live</i></div>
        <div className="stage-signal"><small>{stage.metric}</small><strong>{stage.value}</strong></div>
        {stage.id==="detect"&&<div className="stage-rows"><span><i className="red"/>Blinkit stockout<b>₹34K</b></span><span><i/>Zepto PO shortage<b>₹27K</b></span><span><i/>Shopify mismatch<b>₹18K</b></span></div>}
        {stage.id==="predict"&&<div className="stage-chart" aria-label="Inventory forecast trending to stockout"><span>7 days</span><div className="chart-line"><i/><i/><i/><i/><i/><i/><i/></div><em>Stockout</em></div>}
        {stage.id==="act"&&<div className="stage-transfer"><span>MUMBAI WAREHOUSE<b>380 units</b></span><i>+70 →</i><span>BANGALORE FC<b>43 → 113</b></span></div>}
        {stage.id==="automate"&&<div className="stage-policy"><span>Inventory mismatch <b>AUTO FIX</b></span><span>Replenishment ≤ ₹10K <b>AUTO APPROVE</b></span><span>Large movement <em>OWNER APPROVAL</em></span></div>}
        {stage.id==="verify"&&<div className="stage-verify"><span><small>BEFORE</small><b>43</b></span><i>→</i><span><small>EXPECTED</small><b>113</b></span><i>→</i><span className="verified"><small>ACTUAL</small><b>109</b><em>✓ Successful</em></span></div>}
      </div>
    </motion.div></AnimatePresence></Reveal>
  </div></section>;
}
