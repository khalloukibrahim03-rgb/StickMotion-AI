import type { AnimationScene, SubtitleCue } from "./model";

export type SubtitleFormat = "srt" | "vtt";

interface TimedSubtitle extends SubtitleCue {
  globalStart: number;
  globalEnd: number;
}

function timestamp(seconds: number, format: SubtitleFormat): string {
  const milliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const secs = Math.floor((milliseconds % 60_000) / 1000);
  const ms = milliseconds % 1000;
  const separator = format === "srt" ? "," : ".";
  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    String(secs).padStart(2, "0"),
  ].join(":") + separator + String(ms).padStart(3, "0");
}

/**
 * Serialize subtitles to SRT or WebVTT using a single continuous project clock.
 * Scene-local cue times are offset by the durations of all preceding scenes.
 */
export function serializeSubtitles(
  scenes: Pick<AnimationScene, "durationSeconds" | "subtitles">[],
  format: SubtitleFormat,
): string {
  let sceneOffset = 0;
  const cues: TimedSubtitle[] = [];

  for (const scene of scenes) {
    for (const cue of scene.subtitles ?? []) {
      cues.push({
        ...cue,
        globalStart: sceneOffset + cue.startSeconds,
        globalEnd: sceneOffset + cue.endSeconds,
      });
    }
    sceneOffset += scene.durationSeconds;
  }

  cues.sort((a, b) => a.globalStart - b.globalStart || a.globalEnd - b.globalEnd);
  if (!cues.length) return "";

  const blocks = cues.map((cue, index) => {
    const timing = timestamp(cue.globalStart, format) + " --> " + timestamp(cue.globalEnd, format);
    return (format === "srt" ? String(index + 1) + "\n" : "") + timing + "\n" + cue.text.replace(/\r\n?/g, "\n");
  });

  return (format === "vtt" ? "WEBVTT\n\n" : "") + blocks.join("\n\n") + "\n";
}
