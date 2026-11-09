/** StickMotion Pro Voice profile presets. These tune only the browser test voice;
 * they do not synthesize or export a studio-quality recording.
 */
export type VoiceStyle = "documentary" | "energetic" | "calm";

export interface VoiceStyleProfile {
  id: VoiceStyle;
  label: string;
  description: string;
  rate: number;
  pitch: number;
}

export const VOICE_STYLE_PROFILES: Record<VoiceStyle, VoiceStyleProfile> = {
  documentary: {
    id: "documentary",
    label: "Documentary",
    description: "Warm, steady delivery for science and discovery stories.",
    rate: 0.95,
    pitch: 0.92,
  },
  energetic: {
    id: "energetic",
    label: "Energetic",
    description: "Brighter, quicker delivery for exciting moments.",
    rate: 1.12,
    pitch: 1.08,
  },
  calm: {
    id: "calm",
    label: "Calm",
    description: "Slower, softer delivery for reflective explanations.",
    rate: 0.86,
    pitch: 0.84,
  },
};

export function getVoiceStyleProfile(style: VoiceStyle): VoiceStyleProfile {
  return VOICE_STYLE_PROFILES[style] ?? VOICE_STYLE_PROFILES.documentary;
}

export function isVoiceStyle(value: unknown): value is VoiceStyle {
  return value === "documentary" || value === "energetic" || value === "calm";
}
