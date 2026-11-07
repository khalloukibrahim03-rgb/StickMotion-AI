import { describe, expect, it } from "vitest";
import { createPoseKeyframe, evaluateCamera, evaluatePose } from "./animation";

describe("pose keyframe interpolation", () => {
  it("returns the first pose before the first keyframe", () => {
    const frame = createPoseKeyframe(1, {
      rootPosition: [0, 1, 0],
      leftArmRotation: [0, 0, 1],
      rightArmRotation: [0, 0, -1],
      leftLegRotation: [0, 0, 0],
      rightLegRotation: [0, 0, 0],
    });
    expect(evaluatePose([frame], 0).rootPosition).toEqual([0, 1, 0]);
  });

  it("linearly interpolates position and joint rotations", () => {
    const first = createPoseKeyframe(0);
    const second = createPoseKeyframe(2, {
      rootPosition: [0, 2, 0],
      leftArmRotation: [0, 0, 1],
      rightArmRotation: [0, 0, -1],
      leftLegRotation: [0.5, 0, 0],
      rightLegRotation: [-0.5, 0, 0],
    });
    const middle = evaluatePose([second, first], 1);
    expect(middle.rootPosition).toEqual([0, 1, 0]);
    expect(middle.leftArmRotation[2]).toBeCloseTo(0.5);
    expect(middle.rightArmRotation[2]).toBeCloseTo(-0.5);
    expect(middle.leftLegRotation[0]).toBeCloseTo(0.25);
  });

  it("supports ease-in, ease-out, and ease-in-out curves per outgoing keyframe", () => {
    const end = createPoseKeyframe(2, {
      rootPosition: [2, 0, 0],
      leftArmRotation: [0, 0, 0],
      rightArmRotation: [0, 0, 0],
      leftLegRotation: [0, 0, 0],
      rightLegRotation: [0, 0, 0],
    });
    const easeIn = { ...createPoseKeyframe(0), easing: "ease-in" as const };
    const easeOut = { ...createPoseKeyframe(0), easing: "ease-out" as const };
    const easeInOut = { ...createPoseKeyframe(0), easing: "ease-in-out" as const };
    expect(evaluatePose([easeIn, end], 1).rootPosition[0]).toBeCloseTo(0.5);
    expect(evaluatePose([easeOut, end], 1).rootPosition[0]).toBeCloseTo(1.5);
    expect(evaluatePose([easeInOut, end], 0.5).rootPosition[0]).toBeCloseTo(0.25);
  });

  it("holds the final pose after the last keyframe", () => {
    const last = createPoseKeyframe(3, {
      rootPosition: [1, 0, 0],
      leftArmRotation: [0, 0, 0],
      rightArmRotation: [0, 0, 0],
      leftLegRotation: [0, 0, 0],
      rightLegRotation: [0, 0, 0],
    });
    expect(evaluatePose([last], 9).rootPosition).toEqual([1, 0, 0]);
  });
});


describe("camera keyframe interpolation", () => {
  const base = { position: [0, 0, 5] as [number,number,number], target: [0, 0, 0] as [number,number,number], fov: 40 };
  const track = [
    { id: "a", atSeconds: 0, position: [0,0,5] as [number,number,number], target: [0,0,0] as [number,number,number], fov: 40 },
    { id: "b", atSeconds: 2, position: [2,2,7] as [number,number,number], target: [0,1,0] as [number,number,number], fov: 60 },
  ];
  it("interpolates camera position, target and field of view", () => { expect(evaluateCamera(track, 1, base)).toEqual({position:[1,1,6],target:[0,0.5,0],fov:50}); });
  it("uses endpoint keyframes outside the keyed interval", () => { expect(evaluateCamera(track, -1, base).fov).toBe(40); expect(evaluateCamera(track, 3, base).fov).toBe(60); });
  it("returns the base camera when no keyframes exist", () => { expect(evaluateCamera([], 1, base)).toEqual(base); });
});
