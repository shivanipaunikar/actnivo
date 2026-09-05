"use client";

import { motion, useSpring } from "motion/react";
import type { PointerEvent, ReactNode } from "react";
import { useReducedMotion } from "../../hooks/useReducedMotion";

export function TiltCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  const rotateX = useSpring(0, { stiffness: 120, damping: 20, mass: .8 });
  const rotateY = useSpring(0, { stiffness: 120, damping: 20, mass: .8 });

  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (reduced || event.pointerType === "touch") return;
    const rect = event.currentTarget.getBoundingClientRect();
    rotateY.set(((event.clientX - rect.left) / rect.width - .5) * 6);
    rotateX.set(-((event.clientY - rect.top) / rect.height - .5) * 5);
  };

  const reset = () => { rotateX.set(0); rotateY.set(0); };

  return <motion.div className={`tilt-card ${className}`} onPointerMove={move} onPointerLeave={reset} style={{ rotateX, rotateY, transformPerspective: 1200 }}>{children}</motion.div>;
}
