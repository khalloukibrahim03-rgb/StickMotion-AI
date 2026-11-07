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

export interface AnimationScene {
  id: string;
  name: string;
  description: string;
  durationSeconds: number;
  motion: Motion;
  environment: EnvironmentPreset;
  characterTransform: Transform3D;
  sounds: SceneSound[];
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

export function isAnimationProject(value: unknown): value is AnimationProject {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AnimationProject>;
  return candidate.schemaVersion === PROJECT_SCHEMA_VERSION
    && typeof candidate.id === "string"
    && typeof candidate.title === "string"
    && Array.isArray(candidate.scenes)
    && !!candidate.character
    && typeof candidate.character.primaryColor === "string";
}
