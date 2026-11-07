import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Motion, PoseKeyframe } from "../core/model";
import { evaluatePose, evaluateProceduralMotion } from "../core/animation";
import { getPlaybackTime } from "../core/playback";

function Bone({ length, radius, color }: { length: number; radius: number; color: string }) {
  return <mesh position={[0, -length / 2, 0]} castShadow>
    <cylinderGeometry args={[radius, radius, length, 12]} />
    <meshStandardMaterial color={color} roughness={0.48} />
  </mesh>;
}

export default function Stickman({ color, motion, durationSeconds, keyframes = [] }: { color: string; motion: Motion; durationSeconds: number; keyframes?: PoseKeyframe[] }) {
  const root = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const body = "#e9eaf2";

  useFrame((_, delta) => {
    if (keyframes.length > 0) {
      const pose = evaluatePose(keyframes, getPlaybackTime());
      root.current?.position.set(...pose.rootPosition);
      leftArm.current?.rotation.set(...pose.leftArmRotation);
      rightArm.current?.rotation.set(...pose.rightArmRotation);
      leftLeg.current?.rotation.set(...pose.leftLegRotation);
      rightLeg.current?.rotation.set(...pose.rightLegRotation);
      return;
    }
    // Clear the previous keyed pose before evaluating procedural motion.
    // This prevents stale root offsets and joint rotations after keyframes are removed.
    root.current?.position.set(0, 0, 0);
    leftArm.current?.rotation.set(0, 0, 0);
    rightArm.current?.rotation.set(0, 0, 0);
    leftLeg.current?.rotation.set(0, 0, 0);
    rightLeg.current?.rotation.set(0, 0, 0);
    const t = getPlaybackTime();
    const pose = evaluateProceduralMotion(motion, t, durationSeconds);
    root.current?.position.set(...pose.rootPosition);
    if (leftLeg.current) leftLeg.current.rotation.x = pose.legSwing;
    if (rightLeg.current) rightLeg.current.rotation.x = -pose.legSwing;
    if (leftArm.current) leftArm.current.rotation.x = -pose.armSwing;
    if (rightArm.current) {
      rightArm.current.rotation.x = pose.armSwing;
      rightArm.current.rotation.z = THREE.MathUtils.damp(
        rightArm.current.rotation.z,
        pose.waveArmRotation,
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