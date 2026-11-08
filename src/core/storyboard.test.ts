import { describe, expect, it } from "vitest";
import { buildStoryboard, splitStoryIntoBeats } from "./storyboard";

describe("prompt storyboard planner", () => {
  it("splits a prompt into editable beats and infers English actions", () => {
    const beats = splitStoryIntoBeats("A stickman walks inside. It jumps in surprise. Then it waves hello.");
    expect(beats.map((beat) => beat.suggestedMotion)).toEqual(["walk", "jump", "wave"]);
  });

  it("recognizes common Arabic action descriptions", () => {
    const beats = splitStoryIntoBeats("الشخصية تمشي في الشارع. ثم تقفز من المفاجأة. وفي النهاية تلوح للكاميرا.");
    expect(beats.map((beat) => beat.suggestedMotion)).toEqual(["walk", "jump", "wave"]);
  });

  it("creates camera movement and natural sound cues for generated scenes", () => {
    const scenes = buildStoryboard("A stickman runs through the city. It jumps over a box.");
    expect(scenes).toHaveLength(2);
    expect(scenes[0].cameraKeyframes).toHaveLength(2);
    expect(scenes[0].sounds.some((cue) => cue.effect === "footstep")).toBe(true);
    expect(scenes[1].sounds.map((cue) => cue.effect)).toEqual(["whoosh", "landing"]);
    expect(scenes.every((scene) => scene.camera && scene.camera.fov >= 20)).toBe(true);
  });

  it("limits oversized prompts to twelve beats", () => {
    const prompt = Array.from({ length: 15 }, (_, index) => "Beat " + index + ".").join(" ");
    expect(splitStoryIntoBeats(prompt)).toHaveLength(12);
  });
});


describe("multi-action prompt sequencing", () => {
  it("turns chained actions in one sentence into separate scenes", () => {
    const beats = splitStoryIntoBeats("A stickman walks into the room and jumps in surprise, then it waves to the camera.");
    expect(beats.map((beat) => beat.suggestedMotion)).toEqual(["walk", "jump", "wave"]);
  });

  it("separates chained Arabic actions", () => {
    const beats = splitStoryIntoBeats("الشخصية تمشي في الغرفة ثم تقفز من المفاجأة وفي النهاية تلوح للكاميرا.");
    expect(beats.map((beat) => beat.suggestedMotion)).toEqual(["walk", "jump", "wave"]);
  });
});


describe("prompt environment inference", () => {
  it("selects night and nature stages from scene descriptions", () => {
    const scenes = buildStoryboard("A stickman walks through a rainy neon street. Then it waves in a quiet forest.");
    expect(scenes.map((scene) => scene.environment)).toEqual(["night", "nature"]);
    expect(scenes[0].sounds.some((cue) => cue.effect === "rain")).toBe(true);
    expect(scenes[1].sounds.some((cue) => cue.effect === "wind")).toBe(true);
  });
});


describe("prompt-generated 3D scene props", () => {
  it("adds recognizable objects to the matching scene", () => {
    const scenes = buildStoryboard("A stickman jumps over a wooden box. Then it finds a ball beside a table.");
    expect(scenes[0].props?.map((prop) => prop.kind)).toEqual(["box"]);
    expect(scenes[1].props?.map((prop) => prop.kind)).toEqual(["sphere", "table"]);
    expect(scenes[0].props?.[0].position[0]).toBeCloseTo(0.15);
  });

  it("recognizes Arabic object descriptions", () => {
    const scenes = buildStoryboard("الشخصية تقفز فوق صندوق خشبي. ثم تقترب من كرة.");
    expect(scenes.map((scene) => scene.props?.map((prop) => prop.kind))).toEqual([["box"], ["sphere"]]);
  });
});


describe("prompt object interaction planning", () => {
  it("splits pickup and place actions and keeps the referenced object in view", () => {
    const scenes = buildStoryboard("A stickman walks to a wooden box, picks it up, and puts it down.");
    expect(scenes.map((scene) => scene.interaction)).toEqual([undefined, "pickup", "place"]);
    expect(scenes[1].props?.[0].kind).toBe("box");
    expect(scenes[2].props?.[0].kind).toBe("box");
    expect(scenes[1].props?.[0].position[0]).toBeCloseTo(1.1);
    expect(scenes[1].sounds.some((cue) => cue.effect === "grab")).toBe(true);
    expect(scenes[2].sounds.some((cue) => cue.effect === "setdown")).toBe(true);
  });

  it("recognizes Arabic pickup and placement actions", () => {
    const scenes = buildStoryboard("الشخصية تمشي نحو الصندوق، تلتقطه، ثم تضعه على الأرض.");
    expect(scenes.map((scene) => scene.interaction)).toEqual([undefined, "pickup", "place"]);
    expect(scenes[1].props?.[0].kind).toBe("box");
    expect(scenes[2].props?.[0].kind).toBe("box");
    expect(scenes[1].sounds.some((cue) => cue.effect === "grab")).toBe(true);
    expect(scenes[2].sounds.some((cue) => cue.effect === "setdown")).toBe(true);
  });
});
