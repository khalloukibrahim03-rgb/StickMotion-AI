import { describe, expect, it } from "vitest";
import { createScene } from "./model";
import { duplicateScene, moveScene, resizeSceneDuration } from "./timeline";

describe("scene timeline editing", () => {
  it("moves a scene earlier and later without losing order", () => {
    const scenes = [createScene("A"), createScene("B"), createScene("C")];
    expect(moveScene(scenes, scenes[1].id, -1).map((scene) => scene.name)).toEqual(["B", "A", "C"]);
    expect(moveScene(scenes, scenes[1].id, 1).map((scene) => scene.name)).toEqual(["A", "C", "B"]);
  });

  it("leaves the sequence unchanged at its boundaries or for unknown IDs", () => {
    const scenes = [createScene("A"), createScene("B")];
    expect(moveScene(scenes, scenes[0].id, -1)).toBe(scenes);
    expect(moveScene(scenes, "missing", 1)).toBe(scenes);
  });

  it("duplicates a scene and regenerates nested IDs", () => {
    const scene = createScene("Original");
    scene.props = [{ id: "prop-old", kind: "box", position: [0, 0, 0], scale: [1, 1, 1], color: "#ffffff" }];
    scene.sounds = [{ id: "sound-old", effect: "wind", atSeconds: 1, volume: 0.5 }];
    scene.subtitles = [{ id: "subtitle-old", text: "Hello", startSeconds: 0, endSeconds: 2 }];
    scene.keyframes = [{ id: "key-old", atSeconds: 1, rootPosition: [0, 0, 0], leftArmRotation: [0, 0, 0], rightArmRotation: [0, 0, 0], leftLegRotation: [0, 0, 0], rightLegRotation: [0, 0, 0] }];
    scene.cameraKeyframes = [{ id: "camera-old", atSeconds: 1, position: [4, 3, 6], target: [0, 1, 0], fov: 42 }];
    const copy = duplicateScene(scene);
    expect(copy.id).not.toBe(scene.id);
    expect(copy.name).toBe("Original copy");
    expect(copy.props?.[0].id).not.toBe(scene.props[0].id);
    expect(copy.sounds[0].id).not.toBe(scene.sounds[0].id);
    expect(copy.subtitles?.[0].id).not.toBe(scene.subtitles?.[0].id);
    expect(copy.keyframes?.[0].id).not.toBe(scene.keyframes?.[0].id);
    expect(copy.cameraKeyframes?.[0].id).not.toBe(scene.cameraKeyframes?.[0].id);
    expect(copy.motion).toBe(scene.motion);
  });
});

describe("scene duration editing", () => {
  it("clamps timed elements when a scene is shortened", () => {
    const scene = createScene("Timed");
    scene.sounds = [{ id: "s", effect: "wind", atSeconds: 3.5, volume: 0.5 }];
    scene.subtitles = [
      { id: "keep", text: "Keep", startSeconds: 1, endSeconds: 3.5 },
      { id: "drop", text: "Drop", startSeconds: 3.5, endSeconds: 4 },
    ];
    scene.keyframes = [{ id: "k", atSeconds: 4, rootPosition: [0, 0, 0], leftArmRotation: [0, 0, 0], rightArmRotation: [0, 0, 0], leftLegRotation: [0, 0, 0], rightLegRotation: [0, 0, 0] }];
    scene.cameraKeyframes = [{ id: "c", atSeconds: 4, position: [4, 3, 6], target: [0, 1, 0], fov: 42 }];
    const resized = resizeSceneDuration(scene, 2);
    expect(resized.durationSeconds).toBe(2);
    expect(resized.sounds[0].atSeconds).toBe(2);
    expect(resized.subtitles).toEqual([{ id: "keep", text: "Keep", startSeconds: 1, endSeconds: 2 }]);
    expect(resized.keyframes?.[0].atSeconds).toBe(2);
    expect(resized.cameraKeyframes?.[0].atSeconds).toBe(2);
  });

  it("rejects invalid durations", () => {
    const scene = createScene();
    expect(() => resizeSceneDuration(scene, 0)).toThrow();
    expect(() => resizeSceneDuration(scene, 121)).toThrow();
  });

  it("clamps a fade-in transition when the scene is shortened", () => {
    const scene = createScene("Fade");
    scene.fadeInSeconds = 2.5;
    const resized = resizeSceneDuration(scene, 1);
    expect(resized.fadeInSeconds).toBe(1);
  });
});
