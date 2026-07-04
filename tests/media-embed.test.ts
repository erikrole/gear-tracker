import { describe, expect, it } from "vitest";
import { parseEmbed } from "@/lib/media-embed";

describe("parseEmbed", () => {
  it("parses a YouTube watch URL", () => {
    expect(parseEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({
      src: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      provider: "youtube",
      title: "YouTube video",
    });
  });

  it("parses youtu.be short links", () => {
    expect(parseEmbed("https://youtu.be/dQw4w9WgXcQ")?.src).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    );
  });

  it("parses YouTube /embed, /shorts, and extra query params", () => {
    expect(parseEmbed("https://www.youtube.com/embed/dQw4w9WgXcQ")?.src).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    );
    expect(parseEmbed("https://youtube.com/shorts/dQw4w9WgXcQ")?.src).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    );
    expect(parseEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s")?.src).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    );
  });

  it("parses Vimeo URLs", () => {
    expect(parseEmbed("https://vimeo.com/123456789")).toEqual({
      src: "https://player.vimeo.com/video/123456789",
      provider: "vimeo",
      title: "Vimeo video",
    });
  });

  it("rejects non-allowlisted hosts and unsafe protocols", () => {
    expect(parseEmbed("https://evil.example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(parseEmbed("javascript:alert(1)")).toBeNull();
    expect(parseEmbed("https://www.youtube.com/watch?v=not-an-id")).toBeNull();
    expect(parseEmbed("not a url")).toBeNull();
    expect(parseEmbed("")).toBeNull();
  });
});
