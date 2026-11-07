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

export interface SubtitleImportResult {
  scenes: AnimationScene[];
  importedCount: number;
  skippedCount: number;
}

function parseTimestamp(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  const parts = normalized.split(":");
  if (parts.length !== 2 && parts.length !== 3) return null;
  const timePart = parts[parts.length - 1];
  const [secondsText, millisecondsText = "0"] = timePart.split(".");
  const seconds = Number(secondsText);
  const minutes = Number(parts[parts.length - 2]);
  const hours = parts.length === 3 ? Number(parts[0]) : 0;
  const milliseconds = Number(millisecondsText.padEnd(3, "0").slice(0, 3));
  if (![seconds, minutes, hours, milliseconds].every(Number.isFinite)) return null;
  if (seconds < 0 || seconds >= 60 || minutes < 0 || minutes >= 60 || hours < 0) return null;
  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}

/** Parse standard SRT or WebVTT text into a global project-time subtitle list. */
export function parseSubtitleFile(content: string): SubtitleCue[] {
  const normalized = content.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const blocks = normalized.split(/\n\s*\n/);
  const cues: SubtitleCue[] = [];

  for (const block of blocks) {
    const lines = block.split("\n");
    const timingIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingIndex < 0) continue;
    const timingLine = lines[timingIndex];
    const match = timingLine.match(/((?:\d{2,}:)?\d{2}:\d{2}[,.]\d{3})\s+-->\s+((?:\d{2,}:)?\d{2}:\d{2}[,.]\d{3})/);
    if (!match) continue;

    const startSeconds = parseTimestamp(match[1]);
    const endSeconds = parseTimestamp(match[2]);
    const text = lines.slice(timingIndex + 1)
      .join("\n")
      .replace(/<[^>]*>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim();

    if (startSeconds === null || endSeconds === null || endSeconds <= startSeconds) continue;
    if (!text || text.length > 500) continue;
    cues.push({
      id: "sub_import_" + (cues.length + 1) + "_" + Math.random().toString(36).slice(2, 8),
      text,
      startSeconds,
      endSeconds,
    });
  }
  return cues.sort((a, b) => a.startSeconds - b.startSeconds || a.endSeconds - b.endSeconds);
}

/** Merge imported project-global captions into scene-local cue tracks. Cues crossing scene
 * boundaries are split so each scene can validate, edit, and render its local portion. */
export function distributeSubtitlesAcrossScenes(
  scenes: AnimationScene[],
  cues: SubtitleCue[],
): SubtitleImportResult {
  let offset = 0;
  let importedCount = 0;
  let skippedCount = 0;
  const nextScenes = scenes.map((scene) => {
    const sceneStart = offset;
    const sceneEnd = sceneStart + scene.durationSeconds;
    offset = sceneEnd;

    const additions: SubtitleCue[] = [];
    for (const cue of cues) {
      const overlapStart = Math.max(cue.startSeconds, sceneStart);
      const overlapEnd = Math.min(cue.endSeconds, sceneEnd);
      if (overlapEnd <= overlapStart) continue;
      additions.push({
        id: "sub_scene_" + Math.random().toString(36).slice(2, 10),
        text: cue.text,
        startSeconds: overlapStart - sceneStart,
        endSeconds: overlapEnd - sceneStart,
      });
      importedCount += 1;
    }
    return {
      ...scene,
      subtitles: [...(scene.subtitles ?? []), ...additions]
        .sort((a, b) => a.startSeconds - b.startSeconds),
    };
  });

  const projectDuration = scenes.reduce((total, scene) => total + scene.durationSeconds, 0);
  skippedCount = cues.filter((cue) => cue.startSeconds >= projectDuration || cue.endSeconds <= 0 || cue.endSeconds <= cue.startSeconds).length;
  return { scenes: nextScenes, importedCount, skippedCount };
}
