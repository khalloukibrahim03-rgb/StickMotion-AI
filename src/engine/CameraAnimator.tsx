import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { CameraSettings } from "../core/model";

interface CameraAnimatorProps {
  settings: CameraSettings;
  animate: boolean;
  sceneId: string;
}

/** Applies the editor's evaluated camera state to the live Three.js camera. */
export default function CameraAnimator({ settings, animate, sceneId }: CameraAnimatorProps) {
  const { camera } = useThree();
  const desiredPosition = useRef(new THREE.Vector3(...settings.position));
  const desiredTarget = useRef(new THREE.Vector3(...settings.target));
  const currentTarget = useRef(new THREE.Vector3(...settings.target));
  const desiredFov = useRef(settings.fov);

  useEffect(() => {
    desiredPosition.current.set(...settings.position);
    desiredTarget.current.set(...settings.target);
    desiredFov.current = settings.fov;

    if (!animate) {
      camera.position.copy(desiredPosition.current);
      currentTarget.current.copy(desiredTarget.current);
      camera.lookAt(currentTarget.current);
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.fov = desiredFov.current;
        camera.updateProjectionMatrix();
      }
    }
  }, [camera, settings, animate, sceneId]);

  useEffect(() => {
    camera.position.set(...settings.position);
    currentTarget.current.set(...settings.target);
    camera.lookAt(currentTarget.current);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = settings.fov;
      camera.updateProjectionMatrix();
    }
    desiredPosition.current.set(...settings.position);
    desiredTarget.current.set(...settings.target);
    desiredFov.current = settings.fov;
    // Reset camera interpolation only when entering another scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, sceneId]);

  useFrame((_, delta) => {
    if (!animate) return;
    const alpha = 1 - Math.exp(-10 * delta);
    camera.position.lerp(desiredPosition.current, alpha);
    currentTarget.current.lerp(desiredTarget.current, alpha);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = THREE.MathUtils.damp(camera.fov, desiredFov.current, 10, delta);
      camera.updateProjectionMatrix();
    }
    camera.lookAt(currentTarget.current);
  });

  return null;
}
