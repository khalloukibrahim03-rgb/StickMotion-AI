import { describe, expect, it } from "vitest";
import { getVoiceStyleProfile, isVoiceStyle, VOICE_STYLE_PROFILES } from "./voice-profile";

describe("StickMotion Pro Voice style profiles", () => {
  it("provides a warm documentary default", () => {
    const profile = getVoiceStyleProfile("documentary");
    expect(profile.label).toBe("Documentary");
    expect(profile.rate).toBeLessThan(1);
    expect(profile.pitch).toBeLessThan(1);
  });

  it("keeps every preset within supported speech synthesis ranges", () => {
    for (const profile of Object.values(VOICE_STYLE_PROFILES)) {
      expect(profile.rate).toBeGreaterThanOrEqual(0.5);
      expect(profile.rate).toBeLessThanOrEqual(2);
      expect(profile.pitch).toBeGreaterThanOrEqual(0);
      expect(profile.pitch).toBeLessThanOrEqual(2);
    }
  });

  it("rejects unknown profile identifiers", () => {
    expect(isVoiceStyle("calm")).toBe(true);
    expect(isVoiceStyle("premium-ai")).toBe(false);
  });
});
