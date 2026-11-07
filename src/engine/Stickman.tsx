import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Motion } from "../core/model";

function Bone({ length, radius, color }: { length: number; radius: number; color: string }) {
  return <mesh position={[0, -length / 2, 0]} castShadow>
    <cylinderGeometry args={[radius, radius, length, 12]} />
    <meshStandardMaterial color={color} roughness={0.48} />
  </mesh>;
}

export default function Stickman({ color, motion, playing }: { color: string; motion: Motion; playing: boolean }) {
  const root = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const body = "#e9eaf2";

  useFrame(({ clock }, delta) => {
    if (!playing) return;
    const t = clock.getElapsedTime();
    const stride = motion === "run" ? 9 : 5;
    const swing = motion === "run" ? 0.95 : motion === "walk" ? 0.58 : 0.04;
    if (root.current) {
      root.current.position.y = motion === "jump"
        ? Math.max(0, Math.sin(t * 3.2)) * 0.9
        : Math.sin(t * (motion === "run" ? 18 : 10)) * (motion === "walk" || motion === "run" ? 0.045 : 0.012);
    }
    if (leftLeg.current) leftLeg.current.rotation.x = Math.sin(t * stride) * swing;
    if (rightLeg.current) rightLeg.current.rotation.x = -Math.sin(t * stride) * swing;
    if (leftArm.current) leftArm.current.rotation.x = -Math.sin(t * stride) * swing * 0.7;
    if (rightArm.current) {
      rightArm.current.rotation.x = Math.sin(t * stride) * swing * 0.7;
      rightArm.current.rotation.z = THREE.MathUtils.damp(
        rightArm.current.rotation.z,
        motion === "wave" ? -0.85 + Math.sin(t * 8) * 0.25 : 0,
        8,
        delta,
      );
    }
  });

  return <group ref={root}>
    <mesh position={[0, 2.05, 0]} castShadow>
      <sphereGeometry args={[0.34, 28, 28]} />
      <meshStandardMaterial color={color} roughness={0.32} />
    </mesh>
    <mesh position={[0, 1.42, 0]} castShadow>
      <capsuleGeometry args={[0.095, 0.78, 8, 14]} />
      <meshStandardMaterial color={body} />
    </mesh>
    <group ref={leftArm} position={[-0.13, 1.72, 0]}>
      <Bone length={0.52} radius={0.055} color={body} />
      <mesh position={[-0.12, -0.48, 0]}><sphereGeometry args={[0.065, 12, 12]} /><meshStandardMaterial color={body} /></mesh>
    </group>
    <group ref={rightArm} position={[0.13, 1.72, 0]}>
      <Bone length={0.52} radius={0.055} color={body} />
      <mesh position={[0.12, -0.48, 0]}><sphereGeometry args={[0.065, 12, 12]} /><meshStandardMaterial color={body} /></mesh>
    </group>
    <group ref={leftLeg} position={[-0.09, 1.02, 0]}>
      <Bone length={0.88} radius={0.07} color={body} />
      <mesh position={[0, -0.88, 0.1]}><boxGeometry args={[0.2, 0.1, 0.34]} /><meshStandardMaterial color={color} /></mesh>
    </group>
    <group ref={rightLeg} position={[0.09, 1.02, 0]}>
      <Bone length={0.88} radius={0.07} color={body} />
      <mesh position={[0, -0.88, 0.1]}><boxGeometry args={[0.2, 0.1, 0.34]} /><meshStandardMaterial color={color} /></mesh>
    </group>
  </group>;
}