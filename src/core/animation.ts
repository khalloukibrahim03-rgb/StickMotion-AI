import type { CameraKeyframe, CameraSettings, Motion, PoseKeyframe } from "./model";

export type EvaluatedPose = Omit<PoseKeyframe, "id" | "atSeconds" | "easing">;

const zeroPose: EvaluatedPose = {
  rootPosition: [0, 0, 0],
  leftArmRotation: [0, 0, 0],
  rightArmRotation: [0, 0, 0],
  leftLegRotation: [0, 0, 0],
  rightLegRotation: [0, 0, 0],
};

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function applyEasing(t: number, easing: PoseKeyframe["easing"] = "linear"): number {
  switch (easing) {
    case "ease-in": return t * t;
    case "ease-out": return 1 - (1 - t) * (1 - t);
    case "ease-in-out": return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    default: return t;
  }
}

function mixVector(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
}

/** Evaluate a sorted or unsorted pose track at a scene-local time. */
export function evaluatePose(keyframes: PoseKeyframe[], atSeconds: number): EvaluatedPose {
  if (!keyframes.length) return zeroPose;
  const frames = [...keyframes].sort((a, b) => a.atSeconds - b.atSeconds);
  const first = frames[0];
  const last = frames[frames.length - 1];
  if (atSeconds <= first.atSeconds) return poseOf(first);
  if (atSeconds >= last.atSeconds) return poseOf(last);

  let left = first;
  let right = last;
  for (let index = 0; index < frames.length - 1; index += 1) {
    if (atSeconds >= frames[index].atSeconds && atSeconds <= frames[index + 1].atSeconds) {
      left = frames[index];
      right = frames[index + 1];
      break;
    }
  }
  const span = right.atSeconds - left.atSeconds;
  const rawT = span <= 0 ? 0 : (atSeconds - left.atSeconds) / span;
  const t = applyEasing(rawT, left.easing);
  return {
    rootPosition: mixVector(left.rootPosition, right.rootPosition, t),
    leftArmRotation: mixVector(left.leftArmRotation, right.leftArmRotation, t),
    rightArmRotation: mixVector(left.rightArmRotation, right.rightArmRotation, t),
    leftLegRotation: mixVector(left.leftLegRotation, right.leftLegRotation, t),
    rightLegRotation: mixVector(left.rightLegRotation, right.rightLegRotation, t),
  };
}

function poseOf(frame: PoseKeyframe): EvaluatedPose {
  return {
    rootPosition: [...frame.rootPosition],
    leftArmRotation: [...frame.leftArmRotation],
    rightArmRotation: [...frame.rightArmRotation],
    leftLegRotation: [...frame.leftLegRotation],
    rightLegRotation: [...frame.rightLegRotation],
  };
}

export function createPoseKeyframe(atSeconds: number, pose: EvaluatedPose = zeroPose): PoseKeyframe {
  return {
    id: "key_" + Math.random().toString(36).slice(2, 10),
    atSeconds: Math.max(0, atSeconds),
    rootPosition: [...pose.rootPosition],
    leftArmRotation: [...pose.leftArmRotation],
    rightArmRotation: [...pose.rightArmRotation],
    leftLegRotation: [...pose.leftLegRotation],
    rightLegRotation: [...pose.rightLegRotation],
  };
}


/** Evaluate a scene-local camera track, preserving the base camera outside keyed ranges. */
export function evaluateCamera(keyframes: CameraKeyframe[], atSeconds: number, fallback: CameraSettings): CameraSettings {
  if (!keyframes.length) return fallback;
  const frames = [...keyframes].sort((a, b) => a.atSeconds - b.atSeconds);
  const first = frames[0]; const last = frames[frames.length - 1];
  if (atSeconds <= first.atSeconds) return { position: [...first.position], target: [...first.target], fov: first.fov };
  if (atSeconds >= last.atSeconds) return { position: [...last.position], target: [...last.target], fov: last.fov };
  let left = first; let right = last;
  for (let i = 0; i < frames.length - 1; i += 1) { if (atSeconds >= frames[i].atSeconds && atSeconds <= frames[i + 1].atSeconds) { left = frames[i]; right = frames[i + 1]; break; } }
  const span = right.atSeconds - left.atSeconds;
  const t = applyEasing(span <= 0 ? 0 : (atSeconds - left.atSeconds) / span, left.easing);
  return { position: mixVector(left.position, right.position, t), target: mixVector(left.target, right.target, t), fov: mix(left.fov, right.fov, t) };
}


export interface ProceduralMotionState {
  rootPosition: [number, number, number];
  legSwing: number;
  armSwing: number;
  bodyBounce: number;
  waveArmRotation: number;
  leftArmRotationZ: number;
}

/** Deterministic scene-local movement used by both live preview and video export. */
export function evaluateProceduralMotion(motion: Motion, atSeconds: number, durationSeconds: number, travelAcrossScene = false): ProceduralMotionState {
  const time = Math.max(0, Number.isFinite(atSeconds) ? atSeconds : 0);
  const duration = Math.max(0.001, Number.isFinite(durationSeconds) ? durationSeconds : 1);
  const progress = Math.min(1, time / duration);
  const stride = motion === "run" ? 9 : 5;
  const legSwing = motion === "run" ? 0.95 : motion === "walk" ? 0.58 : 0.04;
  const isJumpingOver = motion === "jump" && travelAcrossScene;
  const isTravelling = motion === "walk" || motion === "run" || isJumpingOver;
  const travelDistance = motion === "run" ? 4.4 : isJumpingOver ? 3.6 : 1.8;
  const startX = isTravelling ? -travelDistance / 2 : 0;
  const rootX = isTravelling ? startX + travelDistance * progress : 0;
  const jumpArc = Math.max(0, Math.sin(Math.PI * progress));
  const bodyBounce = motion === "jump"
    ? jumpArc * (travelAcrossScene ? 1.35 : 0.9)
    : Math.sin(time * (motion === "run" ? 18 : 10)) * (isTravelling ? 0.045 : 0.012);
  return {
    rootPosition: [rootX, bodyBounce, 0],
    legSwing: Math.sin(time * stride) * legSwing,
    armSwing: Math.sin(time * stride) * legSwing * 0.7,
    bodyBounce,
    waveArmRotation: motion === "wave" ? -0.85 + Math.sin(time * 8) * 0.25 : motion === "jump" ? -0.72 * jumpArc : 0,
    leftArmRotationZ: motion === "jump" ? 0.72 * jumpArc : 0,
  };
}
