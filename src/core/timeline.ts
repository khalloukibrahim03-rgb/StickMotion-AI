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
