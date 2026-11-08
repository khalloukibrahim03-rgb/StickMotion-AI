import { createId, type AnimationScene } from "./model";

/** Move a scene one position while preserving its identity and all timeline data. */
export function moveScene(scenes: AnimationScene[], sceneId: string, direction: -1 | 1): AnimationScene[] {
  const from = scenes.findIndex((scene) => scene.id === sceneId);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= scenes.length) return scenes;
  const next = [...scenes];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** Duplicate a scene with fresh IDs for every nested editable timeline item. */
export function duplicateScene(scene: AnimationScene, name = scene.name + " copy"): AnimationScene {
  return {
    ...scene,
    id: createId("scene"),
    name,
    props: scene.props?.map((prop) => ({ ...prop, id: createId("prop") })),
    sounds: scene.sounds.map((cue) => ({ ...cue, id: createId("sound") })),
    subtitles: scene.subtitles?.map((cue) => ({ ...cue, id: createId("subtitle") })),
    keyframes: scene.keyframes?.map((frame) => ({ ...frame, id: createId("keyframe") })),
    cameraKeyframes: scene.cameraKeyframes?.map((frame) => ({ ...frame, id: createId("camera") })),
  };
}

/** Resize a scene while keeping every timed item valid inside its new duration. */
export function resizeSceneDuration(scene: AnimationScene, durationSeconds: number): AnimationScene {
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0.5 || durationSeconds > 120) {
    throw new Error("Scene duration must be between 0.5 and 120 seconds");
  }
  return {
    ...scene,
    durationSeconds,
    fadeInSeconds: scene.fadeInSeconds === undefined ? undefined : Math.min(scene.fadeInSeconds, durationSeconds),
    sounds: scene.sounds.map((cue) => ({ ...cue, atSeconds: Math.min(cue.atSeconds, durationSeconds) })),
    subtitles: scene.subtitles
      ?.filter((cue) => cue.startSeconds < durationSeconds)
      .map((cue) => ({ ...cue, endSeconds: Math.min(cue.endSeconds, durationSeconds) }))
      .filter((cue) => cue.endSeconds > cue.startSeconds),
    keyframes: scene.keyframes?.map((frame) => ({ ...frame, atSeconds: Math.min(frame.atSeconds, durationSeconds) })),
    cameraKeyframes: scene.cameraKeyframes?.map((frame) => ({ ...frame, atSeconds: Math.min(frame.atSeconds, durationSeconds) })),
  };
}

/** Convert a cue timestamp into a clamped percentage within its scene lane. */
export function getTimelineCuePercent(atSeconds: number, durationSeconds: number): number {
  if (!Number.isFinite(atSeconds) || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error("Timeline cue time and scene duration must be finite; duration must be positive");
  }
  return Math.max(0, Math.min(100, (atSeconds / durationSeconds) * 100));
}
