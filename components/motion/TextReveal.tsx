"use client";

import { motion } from "motion/react";
import { useMarketingMotion } from "./MarketingMotionProvider";

export function TextReveal({ text, delay = 0, duration = .8, className = "" }: { text: string; delay?: number; duration?: number; className?: string }) {
  const { reducedMotion } = useMarketingMotion();
  return <span className={`text-mask ${className}`}><motion.span initial={{ y: reducedMotion ? 0 : "110%", opacity: reducedMotion ? 0 : 1 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: reducedMotion ? .25 : duration, delay, ease: [.22, 1, .36, 1] }}>{text}</motion.span></span>;
}
