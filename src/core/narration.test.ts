import { describe, expect, it } from "vitest";
import { createNarrationSubtitleCues } from "./narration";

describe("narration subtitle timing", () => {
  it("splits long narration into readable timed cues", () => {
    const cues = createNarrationSubtitleCues("One two three four five six seven eight nine ten.", 5, 4);
    expect(cues.map((cue) => cue.text)).toEqual(["One two three four", "five six seven eight", "nine ten."]);
    expect(cues[0].startSeconds).toBe(0);
    expect(cues[cues.length - 1].endSeconds).toBe(5);
    expect(cues.every((cue) => cue.endSeconds > cue.startSeconds)).toBe(true);
    expect(cues[1].startSeconds).toBeCloseTo(cues[0].endSeconds);
  });

  it("keeps Arabic words intact and handles a single cue", () => {
    const cues = createNarrationSubtitleCues("مرحباً بالعالم هذا شرح بسيط", 4);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toContain("مرحباً");
    expect(cues[0].endSeconds).toBe(4);
  });

  it("returns no cues for empty text or invalid duration", () => {
    expect(createNarrationSubtitleCues("   ", 4)).toEqual([]);
    expect(createNarrationSubtitleCues("Hello", 0)).toEqual([]);
  });
});
