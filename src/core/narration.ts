import { createId, type SubtitleCue } from "./model";

/**
 * Create readable, approximate subtitle timings for a narration line.
 * This is local timing assistance; users can refine every cue in the editor.
 */
export function createNarrationSubtitleCues(
  text: string,
  durationSeconds: number,
  maxWordsPerCue = 8,
): SubtitleCue[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return [];
  const safeChunkSize = Math.max(1, Math.min(16, Math.floor(maxWordsPerCue) || 8));
  const chunks: string[] = [];
  for (let index = 0; index < words.length; index += safeChunkSize) {
    chunks.push(words.slice(index, index + safeChunkSize).join(" "));
  }
  const totalWords = words.length;
  let elapsedWords = 0;
  return chunks.map((chunk, index) => {
    const count = chunk.split(/\s+/).length;
    const startSeconds = durationSeconds * elapsedWords / totalWords;
    elapsedWords += count;
    const endSeconds = index === chunks.length - 1
      ? durationSeconds
      : durationSeconds * elapsedWords / totalWords;
    return {
      id: createId("caption"),
      text: chunk,
      startSeconds: Number(startSeconds.toFixed(3)),
      endSeconds: Number(endSeconds.toFixed(3)),
    };
  });
}
