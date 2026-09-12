"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { TextReveal } from "../motion/TextReveal";
import { HeroProductDemo } from "./HeroProductDemo";

export function Hero() {
  const { scrollYProgress } = useScroll();

  const copyOpacity = useTransform(
    scrollYProgress,
    [0, 0.14],
    [1, 0.45]
  );

  const visualY = useTransform(
    scrollYProgress,
    [0, 0.18],
    [0, 72]
  );

  const visualScale = useTransform(
    scrollYProgress,
    [0, 0.18],
    [1, 0.95]
  );

  return (
    <section className="hero section-shell" id="top">
      <div className="hero-top-row">
        <motion.div
          className="hero-copy"
          style={{ opacity: copyOpacity }}
        >
          <p className="eyebrow marketing-eyebrow">
            AI COMMERCE OPERATIONS
          </p>

          <h1>
            <span className="hero-headline-line">
              <TextReveal text="Your commerce" delay={0.1} />
              <TextReveal text="operations," delay={0.16} />
            </span>
            <TextReveal
              text="running themselves."
              delay={0.22}
              className="accent-text"
            />
          </h1>

          <motion.p
            className="hero-sub"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7 }}
          >
            Actnivo connects your commerce stack, finds what’s costing you money,
            recommends the highest-impact action, and helps execute the fix.
          </motion.p>

          <motion.div
            className="hero-actions"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.65 }}
          >
            <a className="button" href="/signup">
              Request Early Access
            </a>

            <a className="text-link" href="#product">
              See how it works <span>→</span>
            </a>
          </motion.div>

          <motion.small
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.52 }}
          >
            Built for D2C and omnichannel commerce teams
          </motion.small>
        </motion.div>

        <motion.aside
          className="hero-intelligence-card"
          aria-label="Illustrative Actnivo operational decision"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34, duration: 0.75, ease: [.22, 1, .36, 1] }}
        >
          <header><span>PRODUCT PREVIEW</span><i>ACTNIVO INTELLIGENCE</i></header>
          <div className="hero-risk-summary">
            <span>REVENUE AT RISK</span>
            <strong>₹1.84L</strong>
            <small><i /> 12 issues detected</small>
          </div>
          <div className="hero-risk-object">
            <span>BLINKIT · BANGALORE</span>
            <strong>Vitamin C Serum</strong>
            <small>Stockout in <b>1.4 days</b></small>
          </div>
          <div className="hero-recommended-action">
            <span>✦</span>
            <div><small>RECOMMENDED ACTION</small><strong>Move 70 units</strong><p>Mumbai <i>→</i> Bangalore</p></div>
          </div>
          <footer>Illustrative product demonstration</footer>
        </motion.aside>
      </div>

      <motion.div
        className="hero-visual"
        style={{
          y: visualY,
          scale: visualScale,
        }}
      >
        <HeroProductDemo />
      </motion.div>
    </section>
  );
}
