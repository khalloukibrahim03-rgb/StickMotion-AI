export type SubtitlePreset = "classic" | "bold" | "minimal";
export type SubtitlePosition = "bottom" | "center";
export interface SubtitleRenderStyle { fontSize:number; fontWeight:number; backgroundAlpha:number; horizontalPadding:number; verticalPadding:number; lineHeight:number; verticalAnchor:number; outlineWidth:number; }
export function getSubtitleRenderStyle(preset:SubtitlePreset,position:SubtitlePosition,width:number,height:number):SubtitleRenderStyle {
 if (![width,height].every(value=>Number.isFinite(value)&&value>0)) throw new Error("Subtitle frame dimensions must be positive");
 const settings:Record<SubtitlePreset,Omit<SubtitleRenderStyle,"verticalAnchor">>={
  classic:{fontSize:Math.max(18,Math.round(width*.027)),fontWeight:600,backgroundAlpha:.84,horizontalPadding:1.8,verticalPadding:.8,lineHeight:1.35,outlineWidth:0},
  bold:{fontSize:Math.max(20,Math.round(width*.034)),fontWeight:800,backgroundAlpha:.94,horizontalPadding:1.5,verticalPadding:.7,lineHeight:1.28,outlineWidth:0},
  minimal:{fontSize:Math.max(16,Math.round(width*.024)),fontWeight:700,backgroundAlpha:0,horizontalPadding:.4,verticalPadding:.25,lineHeight:1.3,outlineWidth:Math.max(2,Math.round(width*.002))}
 };
 return {...settings[preset],verticalAnchor:position === "center" ? 0.5 : 0.88};
}
