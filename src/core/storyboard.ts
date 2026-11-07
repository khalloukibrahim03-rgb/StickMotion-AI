import { createId, createScene, type AnimationScene, type EnvironmentPreset, type Motion, type SceneProp } from "./model";

export interface StoryBeat {
  text: string;
  suggestedMotion: Motion;
  durationSeconds: number;
}

/** Offline prompt planner: creates an editable shot list, not AI-generated video. */
export function splitStoryIntoBeats(story: string, limit = 12): StoryBeat[] {
  const sentences = story
    .replace(/\r\n/g, "\n")
    .split(/(?<=[.!?؟。！？])\s+|[;؛]+\s*|\n+|\s+(?:and\s+then|then|after that|finally|next|ثم|بعد ذلك|وفي النهاية|وأخيرًا|and)\s+(?=(?:it\b|he\b|she\b|the stickman\b|the character\b|[a-z][a-z'-]*s\b|ي|ت|يقفز|يركض|يلوح))/i)
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
  if (/\b(run|runs|running|rushed|rush|chase|chases|sprint|sprints)\b|يركض|يجري|ركض|بسرعة|يهرب/.test(value)) return "run";
  if (/\b(jump|jumps|jumping|leap|leaps|hop|hops|surprise|surprised|fall|falls|falling)\b|يقفز|قفز|يسقط|يتفاجأ|مندهش/.test(value)) return "jump";
  if (/\b(wave|waves|waving|hello|greet|greets|greeting|goodbye|bye)\b|يلوّح|يلوح|تلوح|تلوّح|يحيي|مرحبا|وداعا/.test(value)) return "wave";
  if (/\b(walk|walks|walking|walked|enter|enters|entering|leave|leaves|approach|approaches|step|steps|travel|travels)\b|يمشي|تمشي|المشي|مشى|يدخل|تدخل|يخرج|تخرج|يقترب|تقترب|يتقدم|تتقدم/.test(value)) return "walk";
  return "idle";
}

function inferEnvironment(text: string): EnvironmentPreset {
  const value = text.toLocaleLowerCase();
  if (/\b(night|neon|rainy|rain|street|city|urban|dark)\b|ليل|ليلاً|الشارع|مدينة|مطر|نيون/.test(value)) return "night";
  if (/\b(forest|park|nature|garden|beach|mountain|trees|outdoors?)\b|غابة|حديقة|طبيعة|شاطئ|جبل|أشجار/.test(value)) return "nature";
  return "studio";
}

function inferSceneProps(text: string): SceneProp[] {
  const value = text.toLocaleLowerCase();
  const matches: Array<{ kind: SceneProp["kind"]; color: string; scale: [number, number, number] }> = [];
  if (/\b(box|crate|cube)\b|صندوق|مكعب/.test(value)) matches.push({ kind: "box", color: "#c58a52", scale: [1.05, 1.05, 1.05] });
  if (/\b(ball|sphere)\b|كرة/.test(value)) matches.push({ kind: "sphere", color: "#f2b84b", scale: [0.82, 0.82, 0.82] });
  if (/\b(table|desk)\b|طاولة|مكتب/.test(value)) matches.push({ kind: "table", color: "#9a6944", scale: [1, 1, 1] });
  if (/\b(pillar|column|cylinder)\b|عمود|أسطوانة/.test(value)) matches.push({ kind: "cylinder", color: "#7b91a8", scale: [0.72, 1.5, 0.72] });
  if (/\bdoor\b|باب/.test(value)) matches.push({ kind: "box", color: "#76533f", scale: [0.9, 2.5, 0.16] });
  if (!matches.length && /\b(strange object|mysterious object|an object)\b|شيء غريب|جسم غريب/.test(value)) {
    matches.push({ kind: "box", color: "#d4a84e", scale: [0.72, 0.72, 0.72] });
  }
  return matches.slice(0, 8).map((item, index) => ({
    id: createId("prop"),
    kind: item.kind,
    position: [2.25 + (index % 3) * 0.75, item.kind === "sphere" ? 0.48 : item.kind === "cylinder" ? 0.75 : 0.52, -0.4 - Math.floor(index / 3) * 1.2],
    scale: item.scale,
    color: item.color,
  }));
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
    { id: createId("camera"), atSeconds: scene.durationSeconds, easing: "ease-in-out", position: finish, target: [0, 1.05, 0], fov },
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
    scene.environment = inferEnvironment(beat.text);
    scene.props = inferSceneProps(beat.text);
    scene.durationSeconds = beat.durationSeconds;
    createCinematicCamera(scene, beat.text, index);
    addSuggestedSound(scene);
    return scene;
  });
}
