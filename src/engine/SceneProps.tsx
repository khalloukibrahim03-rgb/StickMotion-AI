import type { SceneProp } from "../core/model";

function ScenePropMesh({ prop }: { prop: SceneProp }) {
  if (prop.kind === "table") {
    return <group position={prop.position} scale={prop.scale}>
      <mesh position={[0, 0.82, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.8, 0.14, 1]} />
        <meshStandardMaterial color={prop.color} roughness={0.72} />
      </mesh>
      {([-0.72, 0.72] as const).flatMap((x) => ([-0.36, 0.36] as const).map((z) => (
        <mesh key={String(x) + String(z)} position={[x, 0.4, z]} castShadow>
          <boxGeometry args={[0.12, 0.8, 0.12]} />
          <meshStandardMaterial color={prop.color} roughness={0.78} />
        </mesh>
      )))}
    </group>;
  }

  return <mesh position={prop.position} scale={prop.scale} castShadow receiveShadow>
    {prop.kind === "sphere" ? <sphereGeometry args={[0.5, 28, 20]} /> : prop.kind === "cylinder" ? <cylinderGeometry args={[0.5, 0.5, 1, 24]} /> : <boxGeometry args={[1, 1, 1]} />}
    <meshStandardMaterial color={prop.color} roughness={prop.kind === "sphere" ? 0.3 : 0.68} metalness={prop.kind === "cylinder" ? 0.18 : 0.02} />
  </mesh>;
}

export default function SceneProps({ props }: { props: SceneProp[] }) {
  return <group>{props.map((prop) => <ScenePropMesh key={prop.id} prop={prop} />)}</group>;
}
