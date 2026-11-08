import { describe, expect, it } from "vitest";
import { parseCommonsResults } from "./media-search";

describe("Wikimedia Commons media results", () => {
  it("keeps media URLs, source pages, license, and attribution", () => {
    const results = parseCommonsResults({
      query: { pages: {
        "123": {
          pageid: 123,
          title: "File:Volcano.jpg",
          imageinfo: [{
            url: "https://upload.wikimedia.org/volcano.jpg",
            thumburl: "https://upload.wikimedia.org/thumb.jpg",
            descriptionurl: "https://commons.wikimedia.org/wiki/File:Volcano.jpg",
            mime: "image/jpeg",
            extmetadata: {
              LicenseShortName: { value: "CC BY-SA 4.0" },
              Artist: { value: "<a>Jane Doe</a>" },
              Credit: { value: "Jane Doe collection" },
            },
          }],
        },
      } },
    });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      kind: "image",
      title: "Volcano.jpg",
      license: "CC BY-SA 4.0",
      attribution: "Jane Doe · Jane Doe collection",
    });
  });

  it("recognizes video MIME types and safely ignores incomplete records", () => {
    const results = parseCommonsResults({
      query: { pages: {
        "1": { pageid: 1, title: "File:eruption.webm", imageinfo: [{ url: "https://upload.wikimedia.org/eruption.webm", descriptionurl: "https://commons.wikimedia.org/wiki/File:Eruption.webm", mime: "video/webm" }] },
        "2": { pageid: 2, title: "File:missing.jpg", imageinfo: [{ url: "https://upload.wikimedia.org/missing.jpg" }] },
      } },
    });
    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe("video");
    expect(parseCommonsResults(null)).toEqual([]);
  });
});
