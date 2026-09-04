"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { useMarketingMotion } from "./MarketingMotionProvider";

export function Parallax({ children, distance = 40, className = "" }: { children: React.ReactNode; distance?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { reducedMotion } = useMarketingMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], reducedMotion ? [0, 0] : [distance, -distance]);
  return <motion.div ref={ref} style={{ y }} className={className}>{children}</motion.div>;
}
