"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { TextReveal } from "../motion/TextReveal";
import { HeroProductDemo } from "./HeroProductDemo";

export function Hero() {
  const { scrollYProgress } = useScroll();
  const copyOpacity = useTransform(scrollYProgress, [0, .14], [1, .45]);
  const visualY = useTransform(scrollYProgress, [0, .18], [0, 72]);
  const visualScale = useTransform(scrollYProgress, [0, .18], [1, .95]);
  return <section className="hero section-shell" id="top">
    <motion.div className="hero-copy" style={{ opacity: copyOpacity }}>
      <p className="eyebrow marketing-eyebrow">AI COMMERCE OPERATIONS</p>
      <h1><TextReveal text="Your commerce" delay={.1}/><TextReveal text="operations," delay={.16}/><TextReveal text="running themselves." delay={.22} className="accent-text"/></h1>
      <motion.p className="hero-sub" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .3, duration: .7 }}>Actnivo connects your marketplaces, quick-commerce channels, inventory and operations — finds what is costing you money, recommends what to do, and executes the fix.</motion.p>
      <motion.div className="hero-actions" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .4, duration: .65 }}><a className="button" href="#start">Start Free</a><a className="text-link" href="#product">See how it works <span>→</span></a></motion.div>
      <motion.small initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .52 }}>No credit card <i/> Setup in under 30 minutes</motion.small>
    </motion.div>
    <motion.div className="hero-visual" style={{ y: visualY, scale: visualScale }}><HeroProductDemo /></motion.div>
  </section>;
}
