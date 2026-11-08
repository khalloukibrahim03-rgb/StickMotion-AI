import { describe, expect, it } from "vitest";
import { getSubtitleRenderStyle } from "./subtitle-style";
describe("subtitle render presets",()=>{
 it("scales typography with output resolution",()=>{
  const hd=getSubtitleRenderStyle("classic","bottom",1920,1080);
  const shorts=getSubtitleRenderStyle("classic","bottom",1080,1920);
  expect(hd.fontSize).toBeGreaterThan(shorts.fontSize);
  expect(hd.verticalAnchor).toBe(.88);
 });
 it("supports bold, minimal and centered captions",()=>{
  const bold=getSubtitleRenderStyle("bold","center",1080,1920);
  const minimal=getSubtitleRenderStyle("minimal","bottom",1080,1920);
  expect(bold.fontWeight).toBe(800);
  expect(bold.backgroundAlpha).toBeGreaterThan(.9);
  expect(bold.verticalAnchor).toBe(.5);
  expect(minimal.backgroundAlpha).toBe(0);
  expect(minimal.outlineWidth).toBeGreaterThan(0);
 });
 it("rejects invalid output dimensions",()=>{
  expect(()=>getSubtitleRenderStyle("classic","bottom",0,1080)).toThrow();
 });
});
