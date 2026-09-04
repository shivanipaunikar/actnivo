"use client";

import { motion } from "motion/react";

export function DrawLine({ d, className = "" }: { d: string; className?: string }) {
  return <motion.path d={d} className={className} fill="none" initial={{ pathLength: 0, opacity: 0 }} whileInView={{ pathLength: 1, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 1.2, ease: [.22, 1, .36, 1] }} />;
}
