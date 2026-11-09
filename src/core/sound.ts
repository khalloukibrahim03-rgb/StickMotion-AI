import type { SceneSound } from "./model";

type SoundEffect = SceneSound["effect"];

let audioContext: AudioContext | null = null;
let captureDestination: MediaStreamAudioDestinationNode | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined" || typeof window.AudioContext === "undefined") return null;
  audioContext ??= new window.AudioContext();
  return audioContext;
}

export function beginAudioCapture(): MediaStream | null {
  const context = getAudioContext();
  if (!context || context.state !== "running") return null;
  captureDestination = context.createMediaStreamDestination();
  return captureDestination.stream;
}

export function endAudioCapture(): void {
  captureDestination = null;
}

export async function unlockAudio(): Promise<boolean> {
  const context = getAudioContext();
  if (!context) return false;
  if (context.state === "suspended") await context.resume();
  return context.state === "running";
}

function makeNoise(context: AudioContext, duration: number): AudioBufferSourceNode {
  const length = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    channel[index] = Math.random() * 2 - 1;
  }
  const source = context.createBufferSource();
  source.buffer = buffer;
  return source;
}

/** Creates short, synthesized environmental/foley textures. No music or sustained music beds. */
export function playNaturalSound(effect: SoundEffect, requestedVolume = 0.7): boolean {
  const context = getAudioContext();
  if (!context || context.state !== "running") return false;

  const now = context.currentTime;
  const volume = Math.min(1, Math.max(0, requestedVolume));
  if (volume === 0) return true;

  const output = context.createGain();
  output.gain.setValueAtTime(0.0001, now);
  output.connect(context.destination);
  if (captureDestination) output.connect(captureDestination);

  const noise = makeNoise(context, effect === "wind" ? 1.15 : effect === "rain" ? 0.48 : 0.32);
  const filter = context.createBiquadFilter();
  const noiseGain = context.createGain();
  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(output);

  const tone = context.createOscillator();
  const toneGain = context.createGain();
  tone.connect(toneGain);
  toneGain.connect(output);
  toneGain.gain.setValueAtTime(0.0001, now);

  let duration = 0.25;
  switch (effect) {
    case "footstep":
      duration = 0.13;
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(260, now);
      noiseGain.gain.setValueAtTime(volume * 0.55, now);
      tone.type = "sine";
      tone.frequency.setValueAtTime(92, now);
      tone.frequency.exponentialRampToValueAtTime(58, now + duration);
      toneGain.gain.setValueAtTime(volume * 0.32, now);
      toneGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      break;
    case "whoosh":
      duration = 0.34;
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(420, now);
      filter.frequency.exponentialRampToValueAtTime(1800, now + duration * 0.7);
      noiseGain.gain.setValueAtTime(0.0001, now);
      noiseGain.gain.linearRampToValueAtTime(volume * 0.65, now + duration * 0.35);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      break;
    case "landing":
      duration = 0.24;
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(180, now);
      noiseGain.gain.setValueAtTime(volume * 0.7, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      tone.type = "sine";
      tone.frequency.setValueAtTime(72, now);
      tone.frequency.exponentialRampToValueAtTime(38, now + duration);
      toneGain.gain.setValueAtTime(volume * 0.45, now);
      toneGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      break;
    case "grab":
      duration = 0.18;
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(720, now);
      filter.frequency.exponentialRampToValueAtTime(1500, now + duration * 0.55);
      noiseGain.gain.setValueAtTime(volume * 0.42, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      break;
    case "setdown":
      duration = 0.2;
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(210, now);
      noiseGain.gain.setValueAtTime(volume * 0.62, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      tone.type = "sine";
      tone.frequency.setValueAtTime(84, now);
      tone.frequency.exponentialRampToValueAtTime(42, now + duration);
      toneGain.gain.setValueAtTime(volume * 0.38, now);
      toneGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      break;
    case "rain":
      duration = 0.48;
      filter.type = "highpass";
      filter.frequency.setValueAtTime(1100, now);
      noiseGain.gain.setValueAtTime(volume * 0.28, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      break;
    case "wind":
      duration = 1.15;
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(260, now);
      filter.frequency.linearRampToValueAtTime(720, now + duration * 0.45);
      filter.frequency.linearRampToValueAtTime(220, now + duration);
      noiseGain.gain.setValueAtTime(0.0001, now);
      noiseGain.gain.linearRampToValueAtTime(volume * 0.42, now + duration * 0.35);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      break;
  }

  output.gain.setValueAtTime(volume, now);
  output.gain.setValueAtTime(volume, now + Math.max(0.02, duration * 0.72));
  output.gain.exponentialRampToValueAtTime(0.0001, now + duration + 0.03);
  noise.start(now);
  noise.stop(now + duration + 0.04);
  if (effect === "footstep" || effect === "landing" || effect === "setdown") {
    tone.start(now);
    tone.stop(now + duration + 0.03);
  }
  return true;
}

export const soundEffectLabels: Record<SoundEffect, string> = {
  footstep: "Footstep",
  whoosh: "Whoosh",
  landing: "Landing",
  rain: "Rain",
  wind: "Wind",
  grab: "Object pickup",
  setdown: "Object set-down",
};

/** Select cues crossed by a playback tick without firing them during backward scrubbing. */
export function getCrossedSoundEvents(sounds: SceneSound[], fromSeconds: number, toSeconds: number): SceneSound[] {
  if (toSeconds < fromSeconds) return [];
  return sounds.filter((cue) => (cue.atSeconds > fromSeconds || (fromSeconds === 0 && cue.atSeconds === 0)) && cue.atSeconds <= toSeconds)
    .sort((a, b) => a.atSeconds - b.atSeconds);
}


/** Decode a user-supplied narration recording for playback and video export. */
export async function decodeNarrationAudio(blob: Blob): Promise<AudioBuffer> {
  const context = getAudioContext();
  if (!context) throw new Error("Web Audio is not supported in this browser.");
  const bytes = await blob.arrayBuffer();
  return context.decodeAudioData(bytes);
}

/** Play a recorded voice-over through speakers and the active video-capture mix. */
export function playNarrationAudio(buffer: AudioBuffer, volume = 1): AudioBufferSourceNode | null {
  const context = getAudioContext();
  if (!context || context.state !== "running") return null;
  const source = context.createBufferSource();
  const gain = context.createGain();
  gain.gain.value = Math.min(1, Math.max(0, volume));
  source.buffer = buffer;
  source.connect(gain);
  gain.connect(context.destination);
  if (captureDestination) gain.connect(captureDestination);
  source.start();
  return source;
}
