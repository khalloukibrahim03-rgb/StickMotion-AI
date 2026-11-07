import { describe, expect, it } from "vitest";
import { createProject, isAnimationProject } from "./model";

describe("animation project validation", () => {
  it("accepts a newly created project and its JSON round trip", () => {
    const project = createProject("Portable project");
    const imported: unknown = JSON.parse(JSON.stringify(project));
    expect(isAnimationProject(imported)).toBe(true);
  });

  it("accepts older projects without camera settings", () => {
    const project = createProject();
    const legacy = { ...project, scenes: project.scenes.map(({ camera: _camera, ...scene }) => scene) };
    expect(isAnimationProject(legacy)).toBe(true);
  });

  it("rejects invalid camera settings", () => {
    const project = createProject();
    const malformed = {
      ...project,
      scenes: [{ ...project.scenes[0], camera: { position: [1, 2, 3], target: [0, 0, 0], fov: 120 } }],
    };
    expect(isAnimationProject(malformed)).toBe(false);
  });

  it("rejects subtitle cues outside the scene duration", () => {
    const project = createProject();
    const malformed = { ...project, scenes: [{ ...project.scenes[0], subtitles: [{ id: "late", text: "Hello", startSeconds: 3, endSeconds: 9 }] }] };
    expect(isAnimationProject(malformed)).toBe(false);
  });

  it("accepts valid bilingual subtitle cues", () => {
    const project = createProject();
    const valid = { ...project, scenes: [{ ...project.scenes[0], subtitles: [{ id: "sub", text: "Hello / مرحباً", startSeconds: 0.5, endSeconds: 2 }] }] };
    expect(isAnimationProject(valid)).toBe(true);
  });

  it("rejects unsupported schema versions", () => {
    const project = createProject();
    expect(isAnimationProject({ ...project, schemaVersion: 99 })).toBe(false);
  });

  it("rejects malformed scene transforms", () => {
    const project = createProject();
    const malformed = {
      ...project,
      scenes: [{ ...project.scenes[0], characterTransform: { ...project.scenes[0].characterTransform, position: [0, 1] } }],
    };
    expect(isAnimationProject(malformed)).toBe(false);
  });

  it("rejects sound cues outside the scene duration", () => {
    const project = createProject();
    const malformed = {
      ...project,
      scenes: [{ ...project.scenes[0], sounds: [{ id: "bad", effect: "rain", atSeconds: 99, volume: 0.5 }] }],
    };
    expect(isAnimationProject(malformed)).toBe(false);
  });

  it("rejects invalid keyframe easing values", () => {
    const project = createProject();
    const malformed = {
      ...project,
      scenes: [{
        ...project.scenes[0],
        keyframes: [{
          id: "frame",
          atSeconds: 1,
          easing: "bounce",
          rootPosition: [0, 0, 0],
          leftArmRotation: [0, 0, 0],
          rightArmRotation: [0, 0, 0],
          leftLegRotation: [0, 0, 0],
          rightLegRotation: [0, 0, 0],
        }],
      }],
    };
    expect(isAnimationProject(malformed)).toBe(false);
  });
});
