"use client";

import Lenis from "lenis";
import { createContext, useContext, useEffect, useState } from "react";

const MotionContext = createContext({ reducedMotion: false });

export function MarketingMotionProvider({ children }: { children: React.ReactNode }) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    if (media.matches) return () => media.removeEventListener("change", update);

    const lenis = new Lenis({ duration: 0.9, smoothWheel: true, wheelMultiplier: 0.92 });
    let frame = 0;
    const raf = (time: number) => { lenis.raf(time); frame = requestAnimationFrame(raf); };
    frame = requestAnimationFrame(raf);
    return () => { cancelAnimationFrame(frame); lenis.destroy(); media.removeEventListener("change", update); };
  }, []);

  return <MotionContext.Provider value={{ reducedMotion }}>{children}</MotionContext.Provider>;
}

export const useMarketingMotion = () => useContext(MotionContext);
