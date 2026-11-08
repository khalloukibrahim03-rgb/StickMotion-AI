import { describe, expect, it } from "vitest";
import { getYouTubeExportProfile } from "./youtube";

describe("YouTube export profiles", () => {
  it("provides standard landscape 1080p output", () => {
    expect(getYouTubeExportProfile("landscape")).toMatchObject({ width: 1920, height: 1080, fps: 30 });
  });

  it("provides vertical Shorts output", () => {
    expect(getYouTubeExportProfile("shorts")).toMatchObject({ width: 1080, height: 1920, fps: 30 });
  });

  it("provides square output", () => {
    expect(getYouTubeExportProfile("square")).toMatchObject({ width: 1080, height: 1080, fps: 30 });
  });

  it("uses a higher bitrate for full HD video than square output", () => {
    expect(getYouTubeExportProfile("landscape").videoBitsPerSecond).toBeGreaterThan(getYouTubeExportProfile("square").videoBitsPerSecond);
  });
});
