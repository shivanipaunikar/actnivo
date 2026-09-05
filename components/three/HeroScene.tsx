"use client";

import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import { AnimatePresence, motion } from "motion/react";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useWebGLSupport } from "../../hooks/useWebGLSupport";
import { CommerceNetwork } from "./CommerceNetwork";

const story = [
  ["NETWORK ONLINE", "7 commerce systems connected"],
  ["BLINKIT · DETECT", "Stockout risk · 1.4 days"],
  ["DATA → INTELLIGENCE", "Signal received by Actnivo"],
  ["FINANCIAL IMPACT", "₹28,400 revenue at risk"],
  ["ACTION", "Move 70 units · Mumbai → Bangalore"],
  ["VERIFIED", "₹27,900 value protected"],
];

function StaticNetwork() {
  return <div className="hero-network-fallback" aria-hidden="true"><i className="fallback-ring"/><i className="fallback-core"/>{["AMAZON","BLINKIT","ZEPTO","SHOPIFY","INSTAMART","WAREHOUSE","ERP"].map((name,index)=><span className={`fallback-node fallback-node-${index+1}`} key={name}>{name}</span>)}</div>;
}

export function HeroScene({ phase }: { phase:number }) {
  const reducedMotion = useReducedMotion();
  const { supported,mobile } = useWebGLSupport();
  const useFallback = !supported || mobile || reducedMotion;
  return <div className="hero-scene" aria-label="Actnivo commerce operations network">
    {useFallback ? <StaticNetwork/> : <Canvas dpr={[1,1.5]} gl={{ antialias:true,powerPreference:"high-performance",alpha:true }}><PerspectiveCamera makeDefault position={[0,0,7]} fov={35}/><ambientLight intensity={.65}/><directionalLight position={[4,5,6]} intensity={1.2}/><pointLight position={[-4,-2,3]} intensity={.3}/><CommerceNetwork phase={phase} reducedMotion={reducedMotion}/></Canvas>}
    <div className="hero-network-labels" aria-hidden="true"><span className="network-label label-amazon">Amazon</span><span className="network-label label-blinkit">Blinkit</span><span className="network-label label-zepto">Zepto</span><span className="network-label label-shopify">Shopify</span><span className="network-label label-instamart">Instamart</span><span className="network-label label-warehouse">Warehouse</span><b>ACTNIVO</b></div>
    <AnimatePresence mode="wait"><motion.div className={`hero-network-status phase-${phase}`} key={phase} initial={{opacity:0,y:7}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}} transition={{duration:.45}}><small>{story[phase][0]}</small><strong>{story[phase][1]}</strong></motion.div></AnimatePresence>
  </div>;
}
