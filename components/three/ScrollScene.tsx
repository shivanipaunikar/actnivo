"use client";

import { PerspectiveCamera } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useWebGLSupport } from "../../hooks/useWebGLSupport";
import { CommerceNetwork } from "./CommerceNetwork";

export function ScrollScene({ phase }: { phase:number }) {
  const reducedMotion = useReducedMotion();
  const { supported,mobile } = useWebGLSupport();
  if (!supported || mobile) return <div className={`scroll-scene-fallback fallback-phase-${phase}`} aria-hidden="true"><i/><span/><b>ACTNIVO</b></div>;
  return <Canvas dpr={[1,1.5]} gl={{antialias:true,powerPreference:"high-performance",alpha:true}} aria-label="Actnivo detect, predict, act, automate and verify network">
    <PerspectiveCamera makeDefault position={[0,0,7.2]} fov={35}/>
    <ambientLight intensity={.62}/><directionalLight position={[4,5,6]} intensity={1.15}/><pointLight position={[-4,-2,3]} intensity={.28}/>
    <CommerceNetwork phase={phase+1} compact reducedMotion={reducedMotion}/>
  </Canvas>;
}
