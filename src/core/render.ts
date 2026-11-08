import { evaluateCamera } from "./animation";
import { getCrossedSoundEvents } from "./sound";
import type { AnimationScene, CameraSettings, SceneSound, SubtitleCue } from "./model";

export interface RenderFrame {
  sceneId: string;
  sceneIndex: number;
  sceneTime: number;
  projectTime: number;
  frameIndex: number;
}

/** Stable frame schedule for a project render at a fixed frame rate. */
export function buildRenderSchedule(scenes: AnimationScene[], fps = 30): RenderFrame[] {
  if (!Number.isFinite(fps) || fps < 1 || fps > 60) throw new Error("Frame rate must be between 1 and 60");
  const schedule: RenderFrame[] = [];
  let projectTime = 0;
  let frameIndex = 0;
  scenes.forEach((scene, sceneIndex) => {
    const frameCount = Math.max(1, Math.ceil(scene.durationSeconds * fps));
    for (let localFrame = 0; localFrame < frameCount; localFrame += 1) {
      const sceneTime = Math.min(scene.durationSeconds, localFrame / fps);
      schedule.push({ sceneId: scene.id, sceneIndex, sceneTime, projectTime: projectTime + sceneTime, frameIndex });
      frameIndex += 1;
    }
    projectTime += scene.durationSeconds;
  });
  return schedule;
}

export function getRenderMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}


export function getRenderFileExtension(mimeType: string): "mp4" | "webm" {
  return mimeType.toLowerCase().startsWith("video/mp4") ? "mp4" : "webm";
}

export interface RenderFrameState {
  camera: CameraSettings;
  activeSubtitles: SubtitleCue[];
  soundEvents: SceneSound[];
}

/** Resolve all time-dependent scene data from one exact render timestamp. */
export function evaluateRenderFrame(scene: AnimationScene, frame: RenderFrame, previousSceneTime: number): RenderFrameState {
  if (frame.sceneId !== scene.id) throw new Error("Render frame does not belong to the supplied scene");
  const sceneTime = Math.max(0, Math.min(scene.durationSeconds, frame.sceneTime));
  const fallbackCamera: CameraSettings = scene.camera ?? {
    position: [4.8, 3.2, 6.2],
    target: [0, 1.1, 0],
    fov: 42,
  };
  return {
    camera: evaluateCamera(scene.cameraKeyframes ?? [], sceneTime, fallbackCamera),
    activeSubtitles: (scene.subtitles ?? []).filter((cue) => sceneTime >= cue.startSeconds && sceneTime < cue.endSeconds),
    soundEvents: getCrossedSoundEvents(scene.sounds ?? [], previousSceneTime, sceneTime),
  };
}


/** Opacity of a black overlay used to fade a scene in from black. */
export function getFadeInOpacity(sceneTime: number, fadeInSeconds = 0): number {
  if (!Number.isFinite(sceneTime) || !Number.isFinite(fadeInSeconds) || fadeInSeconds <= 0) return 0;
  return Math.max(0, Math.min(1, 1 - Math.max(0, sceneTime) / fadeInSeconds));
}
