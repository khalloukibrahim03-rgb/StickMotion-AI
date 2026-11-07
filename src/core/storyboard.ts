import { createScene, type AnimationScene, type Motion } from "./model";

export interface StoryBeat {
  text: string;
  suggestedMotion: Motion;
  durationSeconds: number;
}

/**
 * Offline-first story planner. This is deliberately rule-based, not advertised
 * as an LLM. Its output is editable and can later be replaced by an AI provider.
 */
export function splitStoryIntoBeats(story: string, limit = 12): StoryBeat[] {
  const sentences = story
    .replace(/\r\n/g, "\n")
    .split(/(?<=[.!?؟])\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, Math.max(1, limit));

  return sentences.map((text) => ({
    text,
    suggestedMotion: inferMotion(text),
    durationSeconds: estimateDuration(text),
  }));
}

function inferMotion(text: string): Motion {
  const value = text.toLocaleLowerCase();
  if (/\b(run|running|rush|chase|sprint)\b/.test(value)) return "run";
  if (/\b(jump|leap|hop|surprise|fall)\b/.test(value)) return "jump";
  if (/\b(wave|hello|greet|goodbye|bye)\b/.test(value)) return "wave";
  if (/\b(walk|enter|leave|approach|step|travel)\b/.test(value)) return "walk";
  return "idle";
}

function estimateDuration(text: string): number {
  const words = text.split(/\s+/).length;
  return Math.max(3, Math.min(10, Math.round(words / 2.4)));
}

export function buildStoryboard(story: string): AnimationScene[] {
  return splitStoryIntoBeats(story).map((beat, index) => {
    const scene = createScene("Scene " + String(index + 1).padStart(2, "0"));
    scene.description = beat.text;
    scene.motion = beat.suggestedMotion;
    scene.durationSeconds = beat.durationSeconds;
    return scene;
  });
}
