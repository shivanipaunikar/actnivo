"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Reveal } from "../motion/Reveal";
import { ActnivoMark } from "../brand/ActnivoMark";

export function AgentEverywhere(){
  const [executed,setExecuted]=useState(false);
  const [approved,setApproved]=useState(false);
  return <section className="agent-everywhere"><div className="section-shell">
    <Reveal className="agent-everywhere-head"><p className="marketing-eyebrow light">SPOTLIGHT · ASK ACTNIVO</p><h2>One agent.<br/><span>Wherever you work.</span></h2><p>The same operational intelligence on desktop and WhatsApp.</p></Reveal>
    <div className="agent-interface-grid">
      <Reveal variant="slideRight" className="desktop-agent"><div className="interface-head"><span><ActnivoMark/></span><div><b>Actnivo AI</b><small>Watching 9 channels</small></div><i>Online</i></div><div className="desktop-conversation"><div className="operator-message"><small>YOU</small>What&apos;s costing us money today?</div><div className="agent-answer"><small>ACTNIVO</small><p>I found <b>₹84,300</b> in potential revenue risk across 8 issues.</p><span>Blinkit stockout · ₹34K</span><span>Zepto PO shortage · ₹27K</span></div><div className="operator-message"><small>YOU</small>Fix everything safe.</div><div className="agent-answer"><small>ACTNIVO</small><p>5 actions meet your automation rules.</p><button disabled={executed} onClick={()=>setExecuted(true)}>{executed?"✓ 5 actions executing":"Execute 5 →"}</button><AnimatePresence>{executed&&<motion.em initial={{opacity:0}} animate={{opacity:1}}>I&apos;ll verify every outcome.</motion.em>}</AnimatePresence></div></div></Reveal>
      <Reveal variant="slideLeft" className="agent-phone"><div className="interface-head"><span><ActnivoMark/></span><div><b>Actnivo Ops</b><small>WhatsApp agent</small></div><i>Online</i></div><div className="phone-conversation"><small>TODAY</small><div className="phone-risk"><em>STOCKOUT RISK</em><h3>Vitamin C Serum</h3><p>Blinkit · Bangalore</p><dl><div><dt>Revenue at risk</dt><dd>₹28,400</dd></div><div><dt>Recommended</dt><dd>Transfer 70 units</dd></div></dl><button disabled={approved} onClick={()=>setApproved(true)}>{approved?"✓ Approved":"Approve"}</button></div>{approved&&<div className="phone-success">Transfer created · TR-83922</div>}</div></Reveal>
    </div>
  </div></section>;
}
