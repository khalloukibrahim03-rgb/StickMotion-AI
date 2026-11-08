import { describe, expect, it } from "vitest";
import { createProject, isAnimationProject } from "./model";
import type { VisualAsset } from "./media-search";

describe("animation project validation", () => {
  it("accepts a newly created project and its JSON round trip", () => {
    const project = createProject("Portable project");
    const imported: unknown = JSON.parse(JSON.stringify(project));
    expect(isAnimationProject(imported)).toBe(true);
  });

  it("accepts valid fade-in transition settings", () => {
    const project = createProject();
    project.scenes[0].fadeInSeconds = 1.5;
    expect(isAnimationProject(project)).toBe(true);
  });

  it("rejects fade-in durations outside the supported range", () => {
    const project = createProject();
    expect(isAnimationProject({ ...project, scenes: [{ ...project.scenes[0], fadeInSeconds: 4 }] })).toBe(false);
    expect(isAnimationProject({ ...project, scenes: [{ ...project.scenes[0], fadeInSeconds: -1 }] })).toBe(false);
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

  it("accepts bounded scene narration and rejects oversized text", () => {
    const project = createProject();
    project.scenes[0].narrationText = "Welcome to the science story.";
    expect(isAnimationProject(project)).toBe(true);
    project.scenes[0].narrationText = "x".repeat(5001);
    expect(isAnimationProject(project)).toBe(false);
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

  it("accepts a valid scene fade-in and rejects values beyond scene duration", () => {
    const project = createProject();
    const valid = { ...project, scenes: [{ ...project.scenes[0], fadeInSeconds: 1 }] };
    const invalid = { ...project, scenes: [{ ...project.scenes[0], fadeInSeconds: 5 }] };
    expect(isAnimationProject(valid)).toBe(true);
    expect(isAnimationProject(invalid)).toBe(false);
  });

  it("rejects negative or non-finite fade-in durations", () => {
    const project = createProject();
    expect(isAnimationProject({ ...project, scenes: [{ ...project.scenes[0], fadeInSeconds: -1 }] })).toBe(false);
    expect(isAnimationProject({ ...project, scenes: [{ ...project.scenes[0], fadeInSeconds: Number.NaN }] })).toBe(false);
  });
});

describe("scene visual asset validation", () => {
  const asset: VisualAsset = {
    id: "visual-1",
    kind: "image",
    title: "Volcano",
    mediaUrl: "https://upload.wikimedia.org/example.jpg",
    thumbnailUrl: "https://upload.wikimedia.org/thumb.jpg",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Example.jpg",
    license: "CC BY-SA 4.0",
    attribution: "Example Author",
    startSeconds: 0,
    endSeconds: 3,
  };

  it("accepts a properly attributed remote visual asset", () => {
    const project = createProject();
    project.scenes[0].visualAssets = [asset];
    expect(isAnimationProject(project)).toBe(true);
  });

  it("rejects unsafe URLs and asset ranges outside the scene", () => {
    const project = createProject();
    project.scenes[0].visualAssets = [{ ...asset, mediaUrl: "javascript:alert(1)" }];
    expect(isAnimationProject(project)).toBe(false);
    project.scenes[0].visualAssets = [{ ...asset, endSeconds: 99 }];
    expect(isAnimationProject(project)).toBe(false);
  });
});
