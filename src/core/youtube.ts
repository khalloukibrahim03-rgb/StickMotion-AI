export type YouTubeFormat = "landscape" | "shorts" | "square";

export type YouTubeFrameRate = 24 | 30 | 60;

export interface YouTubeExportProfile {
  format: YouTubeFormat;
  label: string;
  width: number;
  height: number;
  fps: YouTubeFrameRate;
  videoBitsPerSecond: number;
}

/** Browser export targets for standard YouTube videos, Shorts, and square uploads. */
export function getYouTubeExportProfile(format: YouTubeFormat, fps: YouTubeFrameRate = 30): YouTubeExportProfile {
  const profiles: Record<YouTubeFormat, YouTubeExportProfile> = {
    landscape: { format: "landscape", label: "YouTube 16:9 1080p", width: 1920, height: 1080, fps, videoBitsPerSecond: Math.round(12_000_000 * fps / 30) },
    shorts: { format: "shorts", label: "YouTube Shorts 9:16 1080p", width: 1080, height: 1920, fps: 30, videoBitsPerSecond: 12_000_000 },
    square: { format: "square", label: "Square 1:1 1080p", width: 1080, height: 1080, fps, videoBitsPerSecond: Math.round(10_000_000 * fps / 30) },
  };
  return profiles[format];
}

export interface CropRect { x: number; y: number; width: number; height: number }

/** Center-crop a source frame to the requested aspect ratio without stretching. */
export function getCenterCropRect(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number): CropRect {
  if (![sourceWidth, sourceHeight, targetWidth, targetHeight].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error("Frame dimensions must be positive finite numbers");
  }
  const sourceAspect = sourceWidth / sourceHeight;
  const targetAspect = targetWidth / targetHeight;
  if (sourceAspect > targetAspect) {
    const width = sourceHeight * targetAspect;
    return { x: (sourceWidth - width) / 2, y: 0, width, height: sourceHeight };
  }
  const height = sourceWidth / targetAspect;
  return { x: 0, y: (sourceHeight - height) / 2, width: sourceWidth, height };
}
