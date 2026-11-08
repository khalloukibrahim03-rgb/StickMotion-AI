import { describe, expect, it } from "vitest";
import { createTopicScript } from "./topic-script";

describe("offline topic script helper", () => {
  it("turns a short English topic into a four-beat script", () => {
    const result = createTopicScript("black holes");
    expect(result?.language).toBe("en");
    expect(result?.script.split("\n")).toHaveLength(4);
    expect(result?.script).toContain("black holes");
  });

  it("supports Arabic topics", () => {
    const result = createTopicScript("الثقوب السوداء");
    expect(result?.language).toBe("ar");
    expect(result?.script).toContain("الثقوب السوداء");
    expect(result?.script.split("\n")).toHaveLength(4);
  });

  it("does not rewrite an existing action prompt or full story", () => {
    expect(createTopicScript("A stickman walks into a room")).toBeNull();
    expect(createTopicScript("A long educational story with many words that already explains everything in detail")).toBeNull();
    expect(createTopicScript("")).toBeNull();
  });
});
