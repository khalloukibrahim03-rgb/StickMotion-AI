import type { SceneInteraction, SceneProp } from "../core/model";

function ScenePropMesh({ prop, lift = 0 }: { prop: SceneProp; lift?: number }) {
  if (prop.kind === "table") {
    return <group position={[prop.position[0], prop.position[1] + lift, prop.position[2]]} scale={prop.scale}>
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

  return <mesh position={[prop.position[0], prop.position[1] + lift, prop.position[2]]} scale={prop.scale} castShadow receiveShadow>
    {prop.kind === "sphere" ? <sphereGeometry args={[0.5, 28, 20]} /> : prop.kind === "cylinder" ? <cylinderGeometry args={[0.5, 0.5, 1, 24]} /> : <boxGeometry args={[1, 1, 1]} />}
    <meshStandardMaterial color={prop.color} roughness={prop.kind === "sphere" ? 0.3 : 0.68} metalness={prop.kind === "cylinder" ? 0.18 : 0.02} />
  </mesh>;
}

export default function SceneProps({ props, interaction, timeSeconds = 0, durationSeconds = 4 }: { props: SceneProp[]; interaction?: SceneInteraction; timeSeconds?: number; durationSeconds?: number }) {
  const progress = Math.min(1, Math.max(0, timeSeconds / Math.max(0.001, durationSeconds)));
  const smooth = (value: number) => {
    const t = Math.min(1, Math.max(0, value));
    return t * t * (3 - 2 * t);
  };
  const lift = interaction === "pickup"
    ? 0.92 * smooth((progress - 0.18) / 0.34)
    : interaction === "place"
      ? 0.92 * (1 - smooth((progress - 0.52) / 0.34))
      : 0;
  return <group>{props.map((prop) => <ScenePropMesh key={prop.id} prop={prop} lift={lift} />)}</group>;
}
