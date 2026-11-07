import { describe, expect, it } from "vitest";
import type { SceneSound } from "./model";
import { getCrossedSoundEvents } from "./sound";

const cues: SceneSound[] = [
  { id: "late", effect: "rain", atSeconds: 2, volume: 0.5 },
  { id: "early", effect: "footstep", atSeconds: 0.5, volume: 0.8 },
  { id: "middle", effect: "landing", atSeconds: 1, volume: 0.6 },
];

describe("sound cue playback scheduling", () => {
  it("returns only cues crossed in the current forward playback tick", () => {
    expect(getCrossedSoundEvents(cues, 0.5, 1.5).map((cue) => cue.id)).toEqual(["middle"]);
  });

  it("sorts crossed cues chronologically even when stored out of order", () => {
    expect(getCrossedSoundEvents(cues, 0, 3).map((cue) => cue.id)).toEqual(["early", "middle", "late"]);
  });

  it("does not fire cues while seeking backwards", () => {
    expect(getCrossedSoundEvents(cues, 2, 0).length).toBe(0);
  });
});
