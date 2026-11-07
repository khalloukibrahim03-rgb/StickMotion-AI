import { describe, expect, it } from "vitest";
import { buildRenderSchedule } from "./render";
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
