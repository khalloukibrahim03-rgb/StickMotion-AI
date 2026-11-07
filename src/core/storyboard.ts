import { createId, createScene, type AnimationScene, type Motion } from "./model";

export interface StoryBeat {
  text: string;
  suggestedMotion: Motion;
  durationSeconds: number;
}

/** Offline prompt planner: creates an editable shot list, not AI-generated video. */
export function splitStoryIntoBeats(story: string, limit = 12): StoryBeat[] {
  const sentences = story
    .replace(/\r\n/g, "\n")
    .split(/(?<=[.!?؟。！？])\s+|[;؛]+\s*|\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, Math.max(1, limit));

  return sentences.map((text) => ({
    text,
    suggestedMotion: inferMotion(text),
  if (/\b(run|runs|running|rushed|rush|chase|chases|sprint|sprints)\b|يركض|يجري|ركض|بسرعة|يهرب/.test(value)) return "run";
  if (/\b(jump|jumps|jumping|leap|leaps|hop|hops|surprise|surprised|fall|falls|falling)\b|يقفز|قفز|يسقط|يتفاجأ|مندهش/.test(value)) return "jump";
  if (/\b(wave|waves|waving|hello|greet|greets|greeting|goodbye|bye)\b|يلوّح|يلوح|تلوح|تلوّح|يحيي|مرحبا|وداعا/.test(value)) return "wave";
  if (/\b(walk|walks|walking|walked|enter|enters|entering|leave|leaves|approach|approaches|step|steps|travel|travels)\b|يمشي|تمشي|المشي|مشى|يدخل|تدخل|يخرج|تخرج|يقترب|تقترب|يتقدم|تتقدم/.test(value)) return "walk";
function inferMotion(text: string): Motion {
  const value = text.toLocaleLowerCase();
  if (/\b(run|runs|running|rushed|rush|chase|chases|sprint|sprints)\b|يركض|يجري|ركض|بسرعة|يهرب/.test(value)) return "run";
  if (/\b(jump|jumps|jumping|leap|leaps|hop|hops|surprise|surprised|fall|falls|falling)\b|يقفز|قفز|يسقط|يتفاجأ|مندهش/.test(value)) return "jump";
  if (/\b(wave|waves|waving|hello|greet|greets|greeting|goodbye|bye)\b|يلوّح|يلوح|تلوح|تلوّح|يحيي|مرحبا|وداعا/.test(value)) return "wave";
  if (/\b(walk|walks|walking|walked|enter|enters|entering|leave|leaves|approach|approaches|step|steps|travel|travels)\b|يمشي|تمشي|المشي|مشى|يدخل|تدخل|يخرج|تخرج|يقترب|تقترب|يتقدم|تتقدم/.test(value)) return "walk";
  return "idle";
}

function estimateDuration(text: string): number {
  const words = text.split(/\s+/).length;
  return Math.max(3, Math.min(10, Math.round(words / 2.4)));
}

function createCinematicCamera(scene: AnimationScene, text: string, index: number): void {
  const value = text.toLocaleLowerCase();
  const close = /close.?up|close shot|لقطة قريبة|قريب/.test(value);
  const wide = /wide shot|establishing|لقطة واسعة|بعيد|مشهد عام/.test(value) || index === 0;
  const low = /low angle|زاوية منخفضة|من الأسفل/.test(value);
  const height = low ? 1.65 : close ? 2.45 : wide ? 3.8 : 2.9;
  const distance = close ? 3.9 : wide ? 8.2 : 6.2;
  const start: [number, number, number] = [distance, height, distance * 0.82];
  const finish: [number, number, number] = [distance * 0.9, height * 1.04, distance * 0.9];
  const fov = close ? 34 : wide ? 48 : 42;
  scene.camera = { position: start, target: [0, 1.05, 0], fov };
  scene.cameraKeyframes = [
    { id: createId("camera"), atSeconds: 0, easing: "ease-in-out", position: start, target: [0, 1.05, 0], fov },
    { id: createId("camera"), atSeconds: scene.durationSeconds, easing: "ease-in-out", position: finish, target: [0, 1.05, 0], fov: scene.camera.fov },
  ];
}

function addSuggestedSound(scene: AnimationScene): void {
  if (scene.motion === "walk" || scene.motion === "run") {
    const interval = scene.motion === "run" ? 0.32 : 0.62;
    for (let at = 0.15; at < scene.durationSeconds; at += interval) {
      scene.sounds.push({ id: createId("sound"), effect: "footstep", atSeconds: Number(at.toFixed(2)), volume: scene.motion === "run" ? 0.72 : 0.52 });
    }
  } else if (scene.motion === "jump") {
    scene.sounds.push({ id: createId("sound"), effect: "whoosh", atSeconds: 0.2, volume: 0.58 });
    scene.sounds.push({ id: createId("sound"), effect: "landing", atSeconds: Math.max(0.5, scene.durationSeconds - 0.25), volume: 0.7 });
  }
}

export function buildStoryboard(story: string): AnimationScene[] {
  return splitStoryIntoBeats(story).map((beat, index) => {
    const scene = createScene("Scene " + String(index + 1).padStart(2, "0"));
    scene.description = beat.text;
    scene.motion = beat.suggestedMotion;
    scene.durationSeconds = beat.durationSeconds;
    createCinematicCamera(scene, beat.text, index);
    addSuggestedSound(scene);
    return scene;
  });
}
