import { create } from "zustand";

interface PlaybackState {
  timeSeconds: number;
  setTimeSeconds: (timeSeconds: number) => void;
}

export const usePlaybackStore = create<PlaybackState>((set) => ({
  timeSeconds: 0,
  setTimeSeconds: (timeSeconds) => set({ timeSeconds }),
}));

/** Read the animation clock without subscribing a React component to every frame. */
export function getPlaybackTime(): number {
  return usePlaybackStore.getState().timeSeconds;
}

/** Update the animation clock for the Three.js frame loop. */
export function setPlaybackTime(timeSeconds: number): void {
  usePlaybackStore.getState().setTimeSeconds(Math.max(0, timeSeconds));
}
