import { describe, expect, it } from "vitest";
import { serializeSubtitles } from "./subtitles";
import type { AnimationScene } from "./model";

const scene = (durationSeconds: number, subtitles: NonNullable<AnimationScene["subtitles"]>): Pick<AnimationScene, "durationSeconds" | "subtitles"> => ({
  durationSeconds,
  subtitles,
});

describe("subtitle serialization", () => {
  it("exports valid SRT timestamps", () => {
    const output = serializeSubtitles([
      scene(5, [{ id: "a", text: "Hello", startSeconds: 0.5, endSeconds: 2.25 }]),
    ], "srt");
    expect(output).toBe("1\n00:00:00,500 --> 00:00:02,250\nHello\n");
  });

  it("exports WebVTT with the required header and dot milliseconds", () => {
    const output = serializeSubtitles([
      scene(5, [{ id: "a", text: "مرحبا", startSeconds: 1.125, endSeconds: 3 }]),
    ], "vtt");
    expect(output).toBe("WEBVTT\n\n00:00:01.125 --> 00:00:03.000\nمرحبا\n");
  });

  it("offsets subtitle times across consecutive scenes", () => {
    const output = serializeSubtitles([
      scene(4, [{ id: "a", text: "Scene one", startSeconds: 1, endSeconds: 2 }]),
      scene(6, [{ id: "b", text: "Scene two", startSeconds: 0.5, endSeconds: 1.5 }]),
    ], "srt");
    expect(output).toContain("00:00:01,000 --> 00:00:02,000\nScene one");
    expect(output).toContain("00:00:04,500 --> 00:00:05,500\nScene two");
  });

  it("sorts captions on the global project clock", () => {
    const output = serializeSubtitles([
      scene(5, [
        { id: "late", text: "Later", startSeconds: 3, endSeconds: 4 },
        { id: "early", text: "Earlier", startSeconds: 1, endSeconds: 2 },
      ]),
    ], "srt");
    expect(output.indexOf("Earlier")).toBeLessThan(output.indexOf("Later"));
  });

  it("returns an empty string when there are no subtitles", () => {
    expect(serializeSubtitles([scene(4, [])], "srt")).toBe("");
    expect(serializeSubtitles([], "vtt")).toBe("");
  });
});
