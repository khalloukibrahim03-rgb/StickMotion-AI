import type { PoseKeyframe } from "./model";

export type EvaluatedPose = Omit<PoseKeyframe, "id" | "atSeconds">;

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
  const t = span <= 0 ? 0 : (atSeconds - left.atSeconds) / span;
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
