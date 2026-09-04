"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { ActnivoMark } from "../brand/ActnivoMark";

const states = ["detected", "risk", "recommend", "ready", "executing", "created", "protected"] as const;

export function HeroProductDemo() {
  const [step, setStep] = useState(0);
  useEffect(() => { const timer = window.setInterval(() => setStep((value) => (value + 1) % states.length), 1300); return () => window.clearInterval(timer); }, []);
  const state = states[step];
  const hasRisk = step >= 1;
  const hasRecommendation = step >= 2;
  const completed = step >= 5;

  return <motion.div className="hero-demo-wrap" initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .48, duration: .85, ease: [.22, 1, .36, 1] }}>
    <div className="float-card float-availability"><span>Blinkit availability</span><strong>92.4%</strong><i>↗ 4.1%</i></div>
    <div className="float-card float-protected"><span>Revenue protected</span><strong>₹84,200</strong><small>today</small></div>
    <div className="product-window">
      <div className="window-bar"><i/><i/><i/><span>Today’s operations</span><em>Live</em></div>
      <div className="demo-body">
        <div className="demo-sidebar"><b><ActnivoMark /></b>{[1,2,3,4,5].map(i=><i key={i}/>)}</div>
        <div className="demo-content">
          <div className="demo-heading"><div><small>THURSDAY, 11:42 AM</small><h3>Today’s operations</h3></div><span>9 channels connected</span></div>
          <div className="demo-metrics">
            <div><small>Revenue at risk</small><strong>{hasRisk ? "₹1,84,300" : "₹0"}</strong></div>
            <div><small>Critical issues</small><strong>{hasRisk ? "12" : "—"}</strong></div>
            <div><small>Actions ready</small><strong>{hasRecommendation ? "7" : "—"}</strong></div>
            <div className="metric-safe"><small>Revenue protected</small><strong>{completed ? "₹3,70,400" : "₹3,42,000"}</strong></div>
          </div>
          <p className="attention-label">NEEDS YOUR ATTENTION</p>
          <motion.div layout className={`demo-issue ${completed ? "complete" : ""}`}>
            <div className="issue-row"><span className="channel-chip">B</span><div><small>{completed ? "TRANSFER VERIFIED" : "BLINKIT STOCKOUT RISK"}</small><h4>Vitamin C Serum · Bangalore</h4></div><strong>{completed ? "Protected" : "1.4 days"}</strong></div>
            <AnimatePresence mode="popLayout">
              {hasRecommendation && <motion.div className="demo-recommend" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} key="recommend"><span>✦</span><div><small>RECOMMENDED ACTION</small><p>{completed ? "70 units are now available in Bangalore" : "Move 70 units Mumbai → Bangalore"}</p></div></motion.div>}
            </AnimatePresence>
            <div className="issue-footer"><span>{completed ? "₹28,400 revenue protected" : hasRisk ? "₹28,400 revenue at risk" : "Scanning inventory…"}</span><motion.button animate={state === "ready" ? { scale: [1, 1.035, 1] } : { scale: 1 }} disabled>{state === "executing" ? "Executing…" : completed ? "✓ Transfer created" : "Approve"}</motion.button></div>
          </motion.div>
          <div className="demo-feed"><i/><span>{state === "detected" ? "Stockout detected" : state === "risk" ? "Financial impact calculated" : state === "protected" ? "Outcome verified" : "Actnivo is monitoring the action"}</span><em>{step + 1}/7</em></div>
        </div>
      </div>
    </div>
  </motion.div>;
}
