"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { Reveal } from "../motion/Reveal";

const issues = [
  { channel:"Blinkit", title:"Stockout in 1.4 days", risk:"₹34K", tone:"critical", detail:"Vitamin C Serum · Bangalore · 43 units left", action:"Transfer 70 units from Mumbai" },
  { channel:"Zepto", title:"PO quantity short", risk:"₹27K", tone:"warning", detail:"PO ZP-2204 · 118 units missing", action:"Request corrected ASN" },
  { channel:"Shopify", title:"Inventory mismatch", risk:"₹18K", tone:"warning", detail:"6 SKUs differ from WMS by 42 units", action:"Run inventory reconciliation" },
  { channel:"Amazon", title:"Listing offline", risk:"₹12K", tone:"neutral", detail:"ASIN B0CV93 · Suppressed 46 minutes ago", action:"Submit compliance evidence" },
];

export function OpsInboxDemo() { const [selected,setSelected]=useState(0); return <section className="marketing-section inbox-section section-shell"><Reveal><p className="marketing-eyebrow">OPS INBOX</p><h2 className="section-title">Your entire operation.<br/><span>One inbox.</span></h2><p className="section-copy">Inventory problems, marketplace issues, PO risks and revenue leaks — prioritized by financial impact.</p></Reveal><Reveal variant="scale" className="inbox-window"><div className="inbox-top"><b>Operations inbox</b><div>{["All","Critical","Needs Approval","Running","Resolved"].map((tab,i)=><button className={i===0?"active":""} key={tab}>{tab}</button>)}</div><span>12 open</span></div><div className="inbox-grid"><div className="issue-list">{issues.map((issue,index)=><motion.button layout onClick={()=>setSelected(index)} className={selected===index?"selected":""} key={issue.title}><i className={issue.tone}/><span><small>{issue.channel}</small><b>{issue.title}</b><em>{issue.detail}</em></span><strong>{issue.risk}<small> risk</small></strong></motion.button>)}</div><motion.div layout key={issues[selected].title} className="issue-detail" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}><p>{issues[selected].channel.toUpperCase()} · PRIORITY {selected+1}</p><h3>{issues[selected].title}</h3><div className="impact-box"><small>ESTIMATED IMPACT</small><strong>{issues[selected].risk} revenue at risk</strong></div><small>ACTNIVO RECOMMENDS</small><h4>{issues[selected].action}</h4><p className="demo-note">Interactive product example — no external action will be taken.</p><button>Review action <span>→</span></button></motion.div></div></Reveal></section>; }
