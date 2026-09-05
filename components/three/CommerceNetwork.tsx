"use client";

import { Line, RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

const BLUE = "#5b55f7";
const GRAPHITE = "#29292f";
const WARM = "#4ac7e8";
const OFF_WHITE = "#f7f7fa";
const SUCCESS = "#2ea66f";

const nodes = [
  { name: "AMAZON", position: [-2.35, 1.05, -.65] as [number,number,number] },
  { name: "BLINKIT", position: [0, 1.8, -.45] as [number,number,number] },
  { name: "ZEPTO", position: [2.25, 1.05, -.8] as [number,number,number] },
  { name: "SHOPIFY", position: [-2.25, -1.05, -.35] as [number,number,number] },
  { name: "INSTAMART", position: [2.35, -1.05, -.55] as [number,number,number] },
  { name: "WAREHOUSE", position: [0, -1.75, -.85] as [number,number,number] },
  { name: "ERP", position: [2.9, .05, -1.35] as [number,number,number] },
];

function EventParticles({ count, paused }: { count: number; paused: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const positions = useMemo(() => Array.from({ length: count }, (_, index) => {
    const angle = index * 2.399;
    const radius = 1.8 + ((index * 37) % 100) / 34;
    return new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle * 1.7) * 2.5, -2.8 - (index % 7) * .24);
  }), [count]);

  useEffect(() => {
    if (!mesh.current) return;
    const dummy = new THREE.Object3D();
    positions.forEach((position, index) => {
      dummy.position.copy(position);
      const scale = index % 13 === 0 ? .055 : .025;
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(index, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  }, [positions]);

  useFrame(({ clock }) => {
    if (mesh.current && !paused) mesh.current.rotation.z = clock.elapsedTime * .012;
  });

  return <instancedMesh ref={mesh} args={[undefined, undefined, count]}><sphereGeometry args={[1, 6, 6]}/><meshBasicMaterial color={WARM} transparent opacity={.42}/></instancedMesh>;
}

function ActnivoCore({ active, success }: { active: boolean; success: boolean }) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.rotation.z = Math.sin(clock.elapsedTime * .28) * .035;
    const target = active ? 1.06 : 1;
    group.current.scale.lerp(new THREE.Vector3(target,target,target), .04);
  });
  const accent = success ? SUCCESS : active ? BLUE : WARM;
  return <group ref={group}>
    <RoundedBox args={[1.32, .86, .14]} radius={.16} smoothness={4} rotation={[0,0,-.18]} position={[0,0,-.08]}><meshPhysicalMaterial color={OFF_WHITE} roughness={.35} metalness={.15} transmission={.05}/></RoundedBox>
    <RoundedBox args={[1.05, .7, .18]} radius={.14} smoothness={4} rotation={[0,0,.16]} position={[0,0,.12]}><meshStandardMaterial color={GRAPHITE} roughness={.3} metalness={.18}/></RoundedBox>
    <mesh rotation={[Math.PI / 2,0,0]}><torusGeometry args={[.82,.018,8,72]}/><meshStandardMaterial color={accent} roughness={.3} metalness={.25}/></mesh>
    {[[-.45,.05,.34],[.08,.28,.34],[.42,-.2,.34],[-.12,-.3,.34]].map((position,index)=><mesh position={position as [number,number,number]} key={index}><sphereGeometry args={[index===1?.075:.05,12,12]}/><meshStandardMaterial color={index===1?accent:OFF_WHITE} roughness={.35} metalness={.12}/></mesh>)}
  </group>;
}

function CommerceNode({ position, active, success, index }: { position:[number,number,number]; active:boolean; success:boolean; index:number }) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (group.current) group.current.position.y = position[1] + Math.sin(clock.elapsedTime * (.28 + index * .035) + index) * .035;
  });
  return <group ref={group} position={position}>
    <RoundedBox args={[.68,.38,.12]} radius={.08} smoothness={3}><meshStandardMaterial color={active ? (success ? SUCCESS : BLUE) : OFF_WHITE} roughness={.42} metalness={.1}/></RoundedBox>
    <mesh position={[0,0,.09]}><circleGeometry args={[.035,12]}/><meshBasicMaterial color={active ? "#ffffff" : GRAPHITE}/></mesh>
  </group>;
}

function DataPulse({ destination, reverse = false, color = BLUE, paused = false }: { destination:[number,number,number]; reverse?:boolean; color?:string; paused?:boolean }) {
  const pulse = useRef<THREE.Mesh>(null);
  const curve = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(0,0,-.05),
    new THREE.Vector3(destination[0] * .48,destination[1] * .42,.28),
    new THREE.Vector3(...destination),
  ]), [destination]);
  useFrame(({ clock }) => {
    if (!pulse.current || paused) return;
    const raw = (clock.elapsedTime * .18) % 1;
    pulse.current.position.copy(curve.getPointAt(reverse ? 1 - raw : raw));
  });
  return <mesh ref={pulse}><sphereGeometry args={[.065,14,14]}/><meshBasicMaterial color={color}/></mesh>;
}

export function CommerceNetwork({ phase = 0, compact = false, reducedMotion = false }: { phase?:number; compact?:boolean; reducedMotion?:boolean }) {
  const world = useRef<THREE.Group>(null);
  const pointer = useRef({ x:0, y:0 });
  useEffect(() => {
    if (reducedMotion || compact) return;
    const move = (event: PointerEvent) => { pointer.current = { x:(event.clientX / window.innerWidth) * 2 - 1, y:(event.clientY / window.innerHeight) * 2 - 1 }; };
    window.addEventListener("pointermove", move, { passive:true });
    return () => window.removeEventListener("pointermove", move);
  }, [compact,reducedMotion]);
  useFrame(({ clock }) => {
    if (!world.current) return;
    world.current.rotation.y += (pointer.current.x * .05 - world.current.rotation.y) * .025;
    world.current.rotation.x += (-pointer.current.y * .03 - world.current.rotation.x) * .025;
    if (!reducedMotion) world.current.position.y = Math.sin(clock.elapsedTime * .24) * .025;
  });
  const activeIndex = phase <= 1 ? 1 : phase >= 4 ? 5 : 1;
  const success = phase >= 5;
  return <group ref={world} scale={compact ? .82 : 1}>
    <EventParticles count={compact ? 70 : 150} paused={reducedMotion}/>
    {nodes.map((node,index)=><group key={node.name}>
      <Line points={[[0,0,-.28],node.position]} color={index===activeIndex ? (success ? SUCCESS : BLUE) : "#aaa39a"} lineWidth={index===activeIndex ? 1.15 : .45} transparent opacity={index===activeIndex?.72:.28}/>
      <CommerceNode position={node.position} index={index} active={index===activeIndex} success={success}/>
    </group>)}
    <ActnivoCore active={phase>=2} success={success}/>
    {phase>=2&&<DataPulse destination={nodes[activeIndex].position} reverse={phase<4} color={success?SUCCESS:BLUE} paused={reducedMotion}/>} 
  </group>;
}
