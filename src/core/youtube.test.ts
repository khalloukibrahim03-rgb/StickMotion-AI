import { describe, expect, it } from "vitest";
import { getCenterCropRect, getYouTubeExportProfile } from "./youtube";

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

  it("supports 24, 30 and 60 FPS export profiles", () => {
    expect(getYouTubeExportProfile("landscape", 24).fps).toBe(24);
    expect(getYouTubeExportProfile("landscape", 60).fps).toBe(60);
    expect(getYouTubeExportProfile("landscape", 60).videoBitsPerSecond).toBe(24_000_000);
  });

  it("uses a higher bitrate for full HD video than square output", () => {
    expect(getYouTubeExportProfile("landscape").videoBitsPerSecond).toBeGreaterThan(getYouTubeExportProfile("square").videoBitsPerSecond);
  });
});

describe("aspect-safe frame cropping", () => {
  it("crops the sides for a portrait target", () => {
    expect(getCenterCropRect(1920, 1080, 1080, 1920)).toEqual({ x: 656.25, y: 0, width: 607.5, height: 1080 });
  });

  it("crops the top and bottom for a landscape target", () => {
    expect(getCenterCropRect(1080, 1920, 1920, 1080)).toEqual({ x: 0, y: 656.25, width: 1080, height: 607.5 });
  });

  it("keeps a matching aspect ratio unchanged", () => {
    expect(getCenterCropRect(1920, 1080, 1280, 720)).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
  });

  it("rejects invalid dimensions", () => {
    expect(() => getCenterCropRect(0, 1080, 1080, 1920)).toThrow();
  });
});
