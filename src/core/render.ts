import type { AnimationScene } from "./model";

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
  const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}
