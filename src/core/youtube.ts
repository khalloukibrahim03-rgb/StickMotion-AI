export type YouTubeFormat = "landscape" | "shorts" | "square";

export interface YouTubeExportProfile {
  format: YouTubeFormat;
  label: string;
  width: number;
  height: number;
  fps: 30;
  videoBitsPerSecond: number;
}

/** Browser export targets for standard YouTube videos, Shorts, and square uploads. */
export function getYouTubeExportProfile(format: YouTubeFormat): YouTubeExportProfile {
  const profiles: Record<YouTubeFormat, YouTubeExportProfile> = {
    landscape: { format: "landscape", label: "YouTube 16:9 1080p", width: 1920, height: 1080, fps: 30, videoBitsPerSecond: 12_000_000 },
    shorts: { format: "shorts", label: "YouTube Shorts 9:16 1080p", width: 1080, height: 1920, fps: 30, videoBitsPerSecond: 12_000_000 },
    square: { format: "square", label: "Square 1:1 1080p", width: 1080, height: 1080, fps: 30, videoBitsPerSecond: 10_000_000 },
  };
  return profiles[format];
}
