/** Canonical, versioned data model shared by the editor and render pipeline. */
export const PROJECT_SCHEMA_VERSION = 1 as const;

export type Motion = "idle" | "walk" | "run" | "jump" | "wave";
export type EnvironmentPreset = "studio" | "night" | "nature";

export interface Transform3D {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

export interface SceneSound {
  id: string;
  effect: "footstep" | "whoosh" | "landing" | "rain" | "wind";
  atSeconds: number;
  volume: number;
}

export type EasingCurve = "linear" | "ease-in" | "ease-out" | "ease-in-out";

export interface PoseKeyframe {
  id: string;
  atSeconds: number;
  easing?: EasingCurve;
  rootPosition: [number, number, number];
  leftArmRotation: [number, number, number];
  rightArmRotation: [number, number, number];
  leftLegRotation: [number, number, number];
  rightLegRotation: [number, number, number];
}

export interface AnimationScene {
  id: string;
  name: string;
  description: string;
  durationSeconds: number;
  motion: Motion;
  environment: EnvironmentPreset;
  characterTransform: Transform3D;
  sounds: SceneSound[];
  keyframes?: PoseKeyframe[];
}

export interface CharacterDefinition {
  id: string;
  name: string;
  primaryColor: string;
  bodyColor: string;
}

export interface AnimationProject {
  schemaVersion: typeof PROJECT_SCHEMA_VERSION;
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  character: CharacterDefinition;
  scenes: AnimationScene[];
}

export function createId(prefix = "id"): string {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return prefix + "_" + random;
}

export function createScene(name = "New scene"): AnimationScene {
  return {
    id: createId("scene"),
    name,
    description: "",
    durationSeconds: 4,
    motion: "idle",
    environment: "studio",
    characterTransform: {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    sounds: [],
  };
}

export function createProject(title = "Untitled animation"): AnimationProject {
  const now = new Date().toISOString();
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: createId("project"),
    title,
    createdAt: now,
    updatedAt: now,
    character: {
      id: createId("character"),
      name: "Stickman",
      primaryColor: "#a78bfa",
      bodyColor: "#e9eaf2",
    },
    scenes: [createScene("Opening scene")],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isVector3(value: unknown): value is [number, number, number] {
  return Array.isArray(value) && value.length === 3 && value.every((part) => typeof part === "number" && Number.isFinite(part));
}

const motions: Motion[] = ["idle", "walk", "run", "jump", "wave"];
const environments: EnvironmentPreset[] = ["studio", "night", "nature"];
const soundEffects: SceneSound["effect"][] = ["footstep", "whoosh", "landing", "rain", "wind"];
const easingCurves: EasingCurve[] = ["linear", "ease-in", "ease-out", "ease-in-out"];

function isSceneSound(value: unknown, duration: number): value is SceneSound {
  if (!isRecord(value)) return false;
  return typeof value.id === "string"
    && soundEffects.includes(value.effect as SceneSound["effect"])
    && typeof value.atSeconds === "number"
    && Number.isFinite(value.atSeconds)
    && value.atSeconds >= 0
    && value.atSeconds <= duration
    && typeof value.volume === "number"
    && Number.isFinite(value.volume)
    && value.volume >= 0
    && value.volume <= 1;
}

function isPoseKeyframe(value: unknown, duration: number): value is PoseKeyframe {
  if (!isRecord(value)) return false;
  return typeof value.id === "string"
    && typeof value.atSeconds === "number"
    && Number.isFinite(value.atSeconds)
    && value.atSeconds >= 0
    && value.atSeconds <= duration
    && (value.easing === undefined || easingCurves.includes(value.easing as EasingCurve))
    && isVector3(value.rootPosition)
    && isVector3(value.leftArmRotation)
    && isVector3(value.rightArmRotation)
    && isVector3(value.leftLegRotation)
    && isVector3(value.rightLegRotation);
}

function isAnimationScene(value: unknown): value is AnimationScene {
  if (!isRecord(value) || !isRecord(value.characterTransform)) return false;
  const duration = value.durationSeconds;
  if (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0) return false;
  const transform = value.characterTransform;
  return typeof value.id === "string"
    && typeof value.name === "string"
    && typeof value.description === "string"
    && motions.includes(value.motion as Motion)
    && environments.includes(value.environment as EnvironmentPreset)
    && isVector3(transform.position)
    && isVector3(transform.rotation)
    && isVector3(transform.scale)
    && Array.isArray(value.sounds)
    && value.sounds.every((sound) => isSceneSound(sound, duration))
    && (value.keyframes === undefined || (Array.isArray(value.keyframes) && value.keyframes.every((frame) => isPoseKeyframe(frame, duration)));
}

export function isAnimationProject(value: unknown): value is AnimationProject {
  if (!isRecord(value) || !isRecord(value.character)) return false;
  const character = value.character;
  return value.schemaVersion === PROJECT_SCHEMA_VERSION
    && typeof value.id === "string"
    && typeof value.title === "string"
    && typeof value.createdAt === "string"
    && typeof value.updatedAt === "string"
    && typeof character.id === "string"
    && typeof character.name === "string"
    && typeof character.primaryColor === "string"
    && typeof character.bodyColor === "string"
    && Array.isArray(value.scenes)
    && value.scenes.length > 0
    && value.scenes.every(isAnimationScene);
}
