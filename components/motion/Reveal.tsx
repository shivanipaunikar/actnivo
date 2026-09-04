"use client";

import { motion } from "motion/react";
import { useMarketingMotion } from "./MarketingMotionProvider";

type Variant = "fade" | "fadeUp" | "fadeDown" | "scale" | "blur" | "slideLeft" | "slideRight";

const variants: Record<Variant, { opacity: number; x?: number; y?: number; scale?: number; filter?: string }> = {
  fade: { opacity: 0 }, fadeUp: { opacity: 0, y: 32 }, fadeDown: { opacity: 0, y: -24 },
  scale: { opacity: 0, scale: .96 }, blur: { opacity: 0, y: 18, filter: "blur(6px)" },
  slideLeft: { opacity: 0, x: 34 }, slideRight: { opacity: 0, x: -34 },
};

export function Reveal({ children, variant = "fadeUp", delay = 0, className = "" }: { children: React.ReactNode; variant?: Variant; delay?: number; className?: string }) {
  const { reducedMotion } = useMarketingMotion();
  return <motion.div className={className} initial={reducedMotion ? { opacity: 0 } : variants[variant]} whileInView={{ opacity: 1, x: 0, y: 0, scale: 1, filter: "blur(0px)" }} viewport={{ once: true, amount: .18 }} transition={{ duration: reducedMotion ? .25 : .7, delay, ease: [.22, 1, .36, 1] }}>{children}</motion.div>;
}
