"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

export function StickyStory({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const scale = useTransform(scrollYProgress, [0, .1, .9, 1], [.98, 1, 1, .97]);
  return <div ref={ref} className="sticky-story-space"><motion.div className="sticky-story" style={{ scale }}>{children}</motion.div></div>;
}
