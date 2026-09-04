"use client";
import { useScroll } from "motion/react";
export function useScrollProgress() { return useScroll().scrollYProgress; }
