export type SubtitlePreset = "classic" | "bold" | "minimal";
export type SubtitlePosition = "bottom" | "center";

export interface SubtitleRenderStyle {
  fontSize: number;
  fontWeight: number;
  backgroundAlpha: number;
  horizontalPadding: number;
  verticalPadding: number;
  lineHeight: number;
  verticalAnchor: number;
  outlineWidth: number;
}

/** Shared caption geometry for the live preview and burned-in export. */
export function getSubtitleRenderStyle(
  preset: SubtitlePreset,
  position: SubtitlePosition,
  width: number,
  height: number,
): SubtitleRenderStyle {
  if (![width, height].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error("Subtitle frame dimensions must be positive");
  }
  const settings: Record<SubtitlePreset, Omit<SubtitleRenderStyle, "verticalAnchor">> = {
    classic: { fontSize: Math.max(18, Math.round(width * 0.027)), fontWeight: 600, backgroundAlpha: 0.84, horizontalPadding: 1.8, verticalPadding: 0.8, lineHeight: 1.35, outlineWidth: 0 },
    bold: { fontSize: Math.max(20, Math.round(width * 0.034)), fontWeight: 800, backgroundAlpha: 0.94, horizontalPadding: 1.5, verticalPadding: 0.7, lineHeight: 1.28, outlineWidth: 0 },
    minimal: { fontSize: Math.max(16, Math.round(width * 0.024)), fontWeight: 700, backgroundAlpha: 0, horizontalPadding: 0.4, verticalPadding: 0.25, lineHeight: 1.3, outlineWidth: Math.max(2, Math.round(width * 0.002)) },
  };
  return { ...settings[preset], verticalAnchor: position === "center" ? 0.5 : 0.88 };
}
