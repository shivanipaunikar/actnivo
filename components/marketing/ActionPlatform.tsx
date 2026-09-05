"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Reveal } from "../motion/Reveal";

const stages = [
  { id:"detect", label:"DETECT", eyebrow:"OPS INBOX", title:"See what needs attention.", copy:"Every operational signal becomes a prioritized issue with its financial impact attached.", metric:"3 critical issues", value:"₹79K revenue at risk" },
  { id:"predict", label:"PREDICT", eyebrow:"STOCKOUT FORECAST", title:"Know what happens next.", copy:"Actnivo reads inventory and demand velocity before availability turns into lost sales.", metric:"Vitamin C Serum", value:"Stockout in 1.4 days" },
  { id:"act", label:"ACT", eyebrow:"RECOMMENDED ACTION", title:"Move 70 units.", copy:"The safest next action is calculated across every warehouse and channel.", metric:"Estimated value protected", value:"₹28,400" },
  { id:"automate", label:"AUTOMATE", eyebrow:"ACTNIVO AUTOPILOT", title:"Set the boundary once.", copy:"Trusted operations execute automatically. Everything else waits for approval.", metric:"Automation policy", value:"2 safe actions enabled" },
  { id:"verify", label:"VERIFY", eyebrow:"ACTION OUTCOME", title:"Prove the action worked.", copy:"Expected and actual results are compared so the system learns from every decision.", metric:"Potential value protected", value:"₹27,900" },
];

export function ActionPlatform() {
  const [active, setActive] = useState(0);
  const [approved, setApproved] = useState(false);
  const stage = stages[active];

  const selectStage = (index:number) => {
    setApproved(false);
    setActive(index);
  };

  const approveAction = () => {
    setApproved(true);
    window.setTimeout(() => selectStage(3), 650);
  };

  return <section className="action-platform" id="product"><div className="section-shell">
    <Reveal className="action-platform-head"><div><p className="marketing-eyebrow">THE ACTION PLATFORM</p><h2>Built for action.<br/><span>Intelligent by design.</span></h2></div><p>One continuous operating loop—from the first signal to the verified result.</p></Reveal>
    <div className="action-tabs" role="tablist" aria-label="Actnivo operating loop">{stages.map((item,index)=><button id={`action-tab-${item.id}`} role="tab" aria-controls="action-stage-panel" aria-selected={index===active} className={index===active?"active":""} onClick={()=>selectStage(index)} key={item.id}><span>0{index+1}</span>{item.label}</button>)}</div>
    <Reveal variant="scale" className="action-stage-shell"><AnimatePresence mode="wait"><motion.div id="action-stage-panel" role="tabpanel" aria-labelledby={`action-tab-${stage.id}`} className={`action-stage action-stage-${stage.id}`} key={stage.id} initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}} transition={{duration:.36}}>
      <div className="action-stage-copy"><small>{stage.eyebrow}</small><h3>{stage.title}</h3><p>{stage.copy}</p>{stage.id==="act"&&<button type="button" className={approved?"approved":""} onClick={approveAction}>{approved?"✓ Approved":"Approve"}<span>→</span></button>}</div>
      <div className="action-stage-visual">
        <div className="stage-window-bar"><span>Actnivo operations</span><i>Live</i></div>
        <div className="stage-signal"><small>{stage.metric}</small><strong>{stage.value}</strong></div>
        {stage.id==="detect"&&<motion.div className="stage-rows" initial="hidden" animate="visible" variants={{visible:{transition:{staggerChildren:.11}}}}>{[["Blinkit stockout","₹34K","red"],["Zepto PO shortage","₹27K","amber"],["Shopify inventory mismatch","₹18K","amber"]].map(([label,value,tone])=><motion.span variants={{hidden:{opacity:0,x:-18},visible:{opacity:1,x:0}}} key={label}><i className={tone}/>{label}<b>{value}</b></motion.span>)}</motion.div>}
        {stage.id==="predict"&&<div className="stage-chart" aria-label="Inventory forecast falling from 113 units to zero"><div className="forecast-axis"><b>113</b><b>0</b></div><div className="forecast-line" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div><div className="forecast-footer"><span>Inventory</span><em>₹28,400 revenue at risk</em></div></div>}
        {stage.id==="act"&&<div className="stage-transfer"><span>MUMBAI<b>380 units</b></span><i><small>+70 UNITS</small>→</i><span>BANGALORE<b>43 units</b></span></div>}
        {stage.id==="automate"&&<div className="stage-policy"><span><i>Inventory mismatch ≤ 5</i><b>AUTO FIX · ON</b></span><span><i>Replenishment ≤ ₹10K</i><b>AUTO APPROVE · ON</b></span><span><i>Large transfer &gt; ₹25K</i><em>OWNER APPROVAL · ON</em></span></div>}
        {stage.id==="verify"&&<div className="stage-verify-wrap"><div className="stage-verify"><span><small>BEFORE</small><b>43</b></span><i>→</i><span><small>EXPECTED</small><b>113</b></span><i>→</i><span className="verified"><small>ACTUAL</small><b>109</b><em>✓ Successful</em></span></div><strong>₹27,900 protected</strong></div>}
      </div>
    </motion.div></AnimatePresence></Reveal>
  </div></section>;
}
