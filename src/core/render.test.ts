import { describe, expect, it } from "vitest";
import { buildRenderSchedule, evaluateRenderFrame, getRenderFileExtension } from "./render";
import { createScene } from "./model";

describe("video render schedule", () => {
  it("creates a deterministic sequence across scene boundaries", () => {
    const first = createScene("Opening");
    first.durationSeconds = 1;
    const second = createScene("Close-up");
    second.durationSeconds = 0.5;
    const frames = buildRenderSchedule([first, second], 2);
    expect(frames).toHaveLength(3);
    expect(frames.map((frame) => frame.sceneId)).toEqual([first.id, first.id, second.id]);
    expect(frames.map((frame) => frame.sceneTime)).toEqual([0, 0.5, 0]);
    expect(frames.map((frame) => frame.projectTime)).toEqual([0, 0.5, 1]);
  });

  it("rejects invalid frame rates", () => {
    expect(() => buildRenderSchedule([createScene()], 0)).toThrow();
    expect(() => buildRenderSchedule([createScene()], 61)).toThrow();
  });

  it("returns no frames for an empty scene list", () => {
    expect(buildRenderSchedule([])).toEqual([]);
  });
});


describe("deterministic render frame evaluation", () => {
  it("resolves camera, subtitles and sound events from the same scene timestamp", () => {
    const scene = createScene("Timed scene");
    scene.durationSeconds = 2;
    scene.cameraKeyframes = [
      { id: "camera-start", atSeconds: 0, position: [0, 2, 5], target: [0, 1, 0], fov: 40 },
      { id: "camera-end", atSeconds: 2, position: [2, 4, 7], target: [0, 1, 0], fov: 60 },
    ];
    scene.subtitles = [{ id: "caption", text: "Hello", startSeconds: 0.4, endSeconds: 0.8 }];
    scene.sounds = [{ id: "step", effect: "footstep", atSeconds: 0.5, volume: 0.6 }];
    const frame = buildRenderSchedule([scene], 2)[1];
    const state = evaluateRenderFrame(scene, frame, 0);
    expect(state.camera.position).toEqual([0.5, 2.5, 5.5]);
    expect(state.camera.fov).toBe(45);
    expect(state.activeSubtitles.map((cue) => cue.text)).toEqual(["Hello"]);
    expect(state.soundEvents.map((cue) => cue.id)).toEqual(["step"]);
  });

  it("rejects a frame associated with another scene", () => {
    const scene = createScene("A");
    const other = createScene("B");
    const frame = buildRenderSchedule([other])[0];
    expect(() => evaluateRenderFrame(scene, frame, 0)).toThrow("does not belong");
  });
});


describe("native recording format selection", () => {
  it("uses an MP4 extension only for an MP4 recorder MIME type", () => {
    expect(getRenderFileExtension("video/mp4;codecs=avc1.42E01E")).toBe("mp4");
    expect(getRenderFileExtension("video/webm;codecs=vp9")).toBe("webm");
  });
});
