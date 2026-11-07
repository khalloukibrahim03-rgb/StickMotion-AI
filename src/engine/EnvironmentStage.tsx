import type { EnvironmentPreset } from "../core/model";

const treePositions: [number, number, number][] = [
  [-7, 0, -8], [-5.2, 0, -10], [6.5, 0, -9], [8.4, 0, -11],
];

const cityBlocks = [
  { position: [-7.5, 2.5, -10] as [number, number, number], size: [3, 5, 2] as [number, number, number] },
  { position: [7.5, 3.5, -11] as [number, number, number], size: [3.4, 7, 2.5] as [number, number, number] },
  { position: [-11, 1.8, -13] as [number, number, number], size: [2.5, 3.6, 2] as [number, number, number] },
  { position: [11, 2.2, -14] as [number, number, number], size: [2.8, 4.4, 2] as [number, number, number] },
];

export default function EnvironmentStage({ environment }: { environment: EnvironmentPreset }) {
  const background = environment === "night" ? "#080d20" : environment === "nature" ? "#9dc5df" : "#111522";
  return <>
    <color attach="background" args={[background]} />
    <fog attach="fog" args={[background, environment === "nature" ? 18 : 14, environment === "nature" ? 42 : 34]} />
    {environment === "night" && <>
      <group>
        {cityBlocks.map((building, index) => <mesh key={index} position={building.position} castShadow receiveShadow>
          <boxGeometry args={building.size} />
          <meshStandardMaterial color="#17213b" roughness={0.86} />
        </mesh>)}
        <mesh position={[-7.5, 2.2, -8.96]}><boxGeometry args={[1.9, 0.12, 0.05]} /><meshStandardMaterial color="#36d9ff" emissive="#1686b8" emissiveIntensity={2.2} /></mesh>
        <mesh position={[7.5, 3.1, -9.72]}><boxGeometry args={[2.2, 0.12, 0.05]} /><meshStandardMaterial color="#ff5bc8" emissive="#b91c80" emissiveIntensity={2.2} /></mesh>
      </group>
      <pointLight position={[-5, 4, -5]} color="#31cfff" intensity={18} distance={18} />
      <pointLight position={[5, 4, -5]} color="#ff4fc8" intensity={16} distance={18} />
    </>}
    {environment === "nature" && <>
      {treePositions.map((position, index) => <group key={index} position={position}>
        <mesh position={[0, 1.05, 0]} castShadow><cylinderGeometry args={[0.16, 0.22, 2.1, 8]} /><meshStandardMaterial color="#69452d" roughness={1} /></mesh>
        <mesh position={[0, 2.45, 0]} castShadow><coneGeometry args={[1.05, 2.4, 9]} /><meshStandardMaterial color={index % 2 ? "#286344" : "#347b4b"} roughness={0.92} /></mesh>
        <mesh position={[0, 3.45, 0]} castShadow><coneGeometry args={[0.72, 1.8, 9]} /><meshStandardMaterial color="#438b55" roughness={0.92} /></mesh>
      </group>)}
      <pointLight position={[-4, 7, 3]} color="#fff0c2" intensity={8} distance={24} />
    </>}
  </>;
}
