"use client";

import { motion, useScroll, useTransform } from "motion/react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useMarketingMotion } from "../motion/MarketingMotionProvider";
import { TextReveal } from "../motion/TextReveal";
import { TiltCard } from "../motion/TiltCard";
import { HeroProductDemo } from "./HeroProductDemo";

const HeroScene = dynamic(() => import("../three/HeroScene").then(module => module.HeroScene), { ssr:false, loading:() => <div className="hero-scene-loading"/> });

export function Hero() {
  const [phase,setPhase] = useState(0);
  const { reducedMotion } = useMarketingMotion();
  useEffect(() => {
    if (reducedMotion) return;
    const timer = window.setInterval(() => setPhase(value => (value + 1) % 6), 2200);
    return () => window.clearInterval(timer);
  }, [reducedMotion]);
  const { scrollYProgress } = useScroll();
  const copyOpacity = useTransform(scrollYProgress, [0, .14], [1, .45]);
  const copyY = useTransform(scrollYProgress, [0, .14], [0, -40]);
  const visualY = useTransform(scrollYProgress, [0, .18], [0, 72]);
  const visualScale = useTransform(scrollYProgress, [0, .18], [1, .95]);
  const sceneScale = useTransform(scrollYProgress, [0, .18], [1, 1.15]);
  const sceneRotate = useTransform(scrollYProgress, [0, .18], [0, 6]);
  const sceneOpacity = useTransform(scrollYProgress, [0, .2], [.72, .08]);
  return <section className="hero section-shell" id="top">
    <motion.div className="hero-three-layer" style={{ scale:sceneScale, rotateY:sceneRotate, opacity:sceneOpacity }}><HeroScene phase={phase}/></motion.div>
    <motion.div className="hero-copy" style={{ opacity: copyOpacity, y:copyY }}>
      <p className="eyebrow marketing-eyebrow">AI COMMERCE OPERATIONS</p>
      <h1><TextReveal text="Your commerce" delay={.1}/><TextReveal text="operations," delay={.16}/><TextReveal text="running themselves." delay={.22} className="accent-text"/></h1>
      <motion.p className="hero-sub" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .3, duration: .7 }}>Actnivo connects your marketplaces, quick-commerce channels, inventory and operations — finds what is costing you money, recommends what to do, and executes the fix.</motion.p>
      <motion.div className="hero-actions" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .4, duration: .65 }}><a className="button" href="#start">Start Free</a><a className="text-link" href="#product">See how it works <span>→</span></a></motion.div>
      <motion.small initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .52 }}>No credit card <i/> Setup in under 30 minutes</motion.small>
    </motion.div>
    <motion.div className="hero-visual" style={{ y: visualY, scale: visualScale }}><TiltCard><HeroProductDemo phase={phase}/></TiltCard></motion.div>
  </section>;
}
