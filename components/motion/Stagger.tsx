"use client";

import { motion } from "motion/react";

export function Stagger({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <motion.div className={className} initial="hidden" whileInView="show" viewport={{ once: true, amount: .18 }} variants={{ hidden: {}, show: { transition: { staggerChildren: .08 } } }}>{children}</motion.div>;
}

export const StaggerItem = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => <motion.div className={className} variants={{ hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: .65, ease: [.22, 1, .36, 1] } } }}>{children}</motion.div>;
