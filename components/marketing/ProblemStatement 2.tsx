"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

const examples = [
  ["Stockout detected", "Blinkit Bangalore inventory will run out tomorrow."],
  ["Revenue impact", "₹28,400 revenue at risk."],
  ["Recommended action", "Move 70 units Mumbai → Bangalore."],
];

export function ProblemStatement() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const firstOpacity = useTransform(scrollYProgress, [0, .36, .58], [1, 1, 0]);
  const firstY = useTransform(scrollYProgress, [0, .58], [0, -64]);
  const secondOpacity = useTransform(scrollYProgress, [.34, .58, 1], [0, 1, 1]);
  const secondY = useTransform(scrollYProgress, [.34, .68], [64, 0]);
  const examplesOpacity = useTransform(scrollYProgress, [.58, .82], [0, 1]);

  return <section className="problem-positioning" ref={ref}>
    <div className="problem-sticky section-shell">
      <p className="marketing-eyebrow">WHY ACTNIVO</p>
      <div className="problem-statements">
        <motion.p style={{ opacity: firstOpacity, y: firstY }}>Most commerce software tells you<br/>what happened.</motion.p>
        <motion.div className="problem-answer" style={{ opacity: secondOpacity, y: secondY }}><h2>Actnivo <span>fixes it.</span></h2><p>By telling you what needs to happen next.</p></motion.div>
      </div>
      <motion.div className="problem-examples" style={{ opacity: examplesOpacity }}>
        {examples.map(([title, detail], index) => <article key={title}><small>0{index + 1}</small><div><b>{title}</b><p>{detail}</p></div></article>)}
      </motion.div>
    </div>
  </section>;
}
