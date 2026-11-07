import { describe, expect, it } from "vitest";
import { distributeSubtitlesAcrossScenes, parseSubtitleFile, serializeSubtitles } from "./subtitles";
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


describe("subtitle import", () => {
  it("parses SRT captions and preserves text", () => {
    const cues = parseSubtitleFile("1\\n00:00:00,500 --> 00:00:02,250\\nHello world\\n");
    expect(cues).toHaveLength(1);
    expect(cues[0].startSeconds).toBe(0.5);
    expect(cues[0].endSeconds).toBe(2.25);
    expect(cues[0].text).toBe("Hello world");
  });

  it("parses WebVTT Arabic captions and ignores cue settings", () => {
    const cues = parseSubtitleFile("WEBVTT\\n\\n00:00:01.000 --> 00:00:03.500 align:start\\nمرحباً بالعالم\\n");
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe("مرحباً بالعالم");
    expect(cues[0].startSeconds).toBe(1);
    expect(cues[0].endSeconds).toBe(3.5);
  });

  it("splits captions that cross scene boundaries", () => {
    const first = {
      id: "one", name: "One", description: "", durationSeconds: 3, motion: "idle" as const, environment: "studio" as const,
      characterTransform: { position: [0,0,0] as [number,number,number], rotation: [0,0,0] as [number,number,number], scale: [1,1,1] as [number,number,number] },
      sounds: [], subtitles: [],
    };
    const second = { ...first, id: "two", name: "Two", durationSeconds: 4 };
    const cue = { id: "global", text: "Across scenes", startSeconds: 2.5, endSeconds: 3.5 };
    const result = distributeSubtitlesAcrossScenes([first, second], [cue]);
    expect(result.importedCount).toBe(2);
    expect(result.scenes[0].subtitles?.[0]).toMatchObject({ text: "Across scenes", startSeconds: 2.5, endSeconds: 3 });
    expect(result.scenes[1].subtitles?.[0]).toMatchObject({ text: "Across scenes", startSeconds: 0, endSeconds: 0.5 });
  });

  it("counts captions outside the project duration as skipped", () => {
    const scene = {
      id: "only", name: "Only", description: "", durationSeconds: 2, motion: "idle" as const, environment: "studio" as const,
      characterTransform: { position: [0,0,0] as [number,number,number], rotation: [0,0,0] as [number,number,number], scale: [1,1,1] as [number,number,number] },
      sounds: [], subtitles: [],
    };
    const result = distributeSubtitlesAcrossScenes([scene], [{ id: "late", text: "Late", startSeconds: 3, endSeconds: 4 }]);
    expect(result.importedCount).toBe(0);
    expect(result.skippedCount).toBe(1);
  });
});
