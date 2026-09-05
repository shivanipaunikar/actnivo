"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { ActnivoMark } from "../brand/ActnivoMark";
import { Reveal } from "../motion/Reveal";

export function WhatsAppAgent() {
  const [approved, setApproved] = useState(false);
  return <section className="marketing-section whatsapp-section"><div className="section-shell whatsapp-layout">
    <Reveal><p className="marketing-eyebrow">ACTNIVO ON WHATSAPP</p><h2 className="section-title">Run commerce<br/><span>from WhatsApp.</span></h2><p className="section-copy">Get the issue, financial impact, recommendation and approval controls wherever your team already works.</p><div className="whatsapp-proof"><span>01</span><p><b>Fast approvals</b><small>Act without opening another dashboard.</small></p></div><div className="whatsapp-proof"><span>02</span><p><b>Full audit trail</b><small>Every response is captured and verified.</small></p></div></Reveal>
    <Reveal variant="scale" className="phone-shell"><div className="phone-top"><i/><span><ActnivoMark /></span><div><b>Actnivo Ops</b><small>online</small></div><em>•••</em></div><div className="phone-chat"><small className="phone-date">TODAY</small><div className="wa-message"><b><i/> Stockout Risk</b><h3>Vitamin C Serum</h3><p>Blinkit — Bangalore</p><dl><div><dt>Stock remaining</dt><dd>1.4 days</dd></div><div><dt>Revenue at risk</dt><dd>₹28,400</dd></div></dl><small>RECOMMENDED</small><strong>Transfer 70 units<br/>Mumbai → Bangalore</strong><div className="wa-actions"><button onClick={()=>setApproved(true)}>Approve</button><button>Modify</button><button>Ignore</button></div></div><AnimatePresence>{approved&&<motion.div className="wa-confirm" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}><span>✓</span><p><b>Transfer created.</b><small>TR-83922 · I’ll verify the outcome.</small></p></motion.div>}</AnimatePresence></div><div className="phone-input">Reply to Actnivo… <span>➤</span></div></Reveal>
  </div></section>;
}
