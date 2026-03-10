import { describe, it, expect } from "vitest";
import { isValidBHUrl, parseHTML } from "@/lib/services/bh-parser";

describe("isValidBHUrl", () => {
  it("accepts valid B&H URLs", () => {
    expect(isValidBHUrl("https://www.bhphotovideo.com/c/product/123/foo.html")).toBe(true);
    expect(isValidBHUrl("https://bhphotovideo.com/c/product/456")).toBe(true);
  });

  it("rejects non-B&H URLs", () => {
    expect(isValidBHUrl("https://amazon.com/dp/B123")).toBe(false);
    expect(isValidBHUrl("https://adorama.com/product/123")).toBe(false);
    expect(isValidBHUrl("not a url")).toBe(false);
    expect(isValidBHUrl("")).toBe(false);
  });
});

describe("parseHTML", () => {
  const SOURCE = "https://www.bhphotovideo.com/c/product/123/test.html";

  it("extracts product data from JSON-LD", () => {
    const html = `
      <html>
      <head>
        <script type="application/ld+json">
        {
          "@type": "Product",
          "name": "Sony Alpha a7 IV Mirrorless Digital Camera Body",
          "brand": { "name": "Sony" },
          "mpn": "ILCE7M4/B",
          "image": "https://static.bhphoto.com/images/images500x500/sony_alpha.jpg"
        }
        </script>
      </head>
      <body></body>
      </html>
    `;

    const result = parseHTML(html, SOURCE);
    expect(result.name).toBe("Sony Alpha a7 IV Mirrorless Digital Camera Body");
    expect(result.brand).toBe("Sony");
    expect(result.model).toBe("ILCE7M4/B");
    expect(result.imageUrl).toBe("https://static.bhphoto.com/images/images500x500/sony_alpha.jpg");
    expect(result.sourceUrl).toBe(SOURCE);
  });

  it("extracts brand as string when not nested object", () => {
    const html = `
      <script type="application/ld+json">
      { "@type": "Product", "name": "Canon EOS R5", "brand": "Canon", "sku": "4147C002" }
      </script>
    `;
    const result = parseHTML(html, SOURCE);
    expect(result.brand).toBe("Canon");
    expect(result.model).toBe("4147C002");
  });

  it("falls back to og:title when JSON-LD has no name", () => {
    const html = `
      <meta property="og:title" content="Nikon Z9 Body | B&H Photo" />
    `;
    const result = parseHTML(html, SOURCE);
    expect(result.name).toBe("Nikon Z9 Body");
  });

  it("falls back to og:image when JSON-LD has no image", () => {
    const html = `
      <script type="application/ld+json">
      { "@type": "Product", "name": "Test Product", "brand": "Test" }
      </script>
      <meta property="og:image" content="https://cdn.bhphoto.com/test.jpg" />
    `;
    const result = parseHTML(html, SOURCE);
    expect(result.imageUrl).toBe("https://cdn.bhphoto.com/test.jpg");
  });

  it("falls back to HTML title as last resort", () => {
    const html = `
      <html><head><title>Rode NTG5 Shotgun Microphone | B&H Photo Video</title></head></html>
    `;
    const result = parseHTML(html, SOURCE);
    expect(result.name).toBe("Rode NTG5 Shotgun Microphone");
  });

  it("strips B&H suffix from name", () => {
    const html = `
      <meta property="og:title" content="Sony FX3 Full-Frame Cinema Camera | B&H Photo Video" />
    `;
    const result = parseHTML(html, SOURCE);
    expect(result.name).toBe("Sony FX3 Full-Frame Cinema Camera");
  });

  it("extracts brand from name when not in JSON-LD", () => {
    const html = `
      <meta property="og:title" content="Canon RF 70-200mm f/2.8 L IS USM Lens" />
    `;
    const result = parseHTML(html, SOURCE);
    expect(result.brand).toBe("Canon");
  });

  it("returns nulls for empty HTML", () => {
    const result = parseHTML("", SOURCE);
    expect(result.name).toBeNull();
    expect(result.brand).toBeNull();
    expect(result.model).toBeNull();
    expect(result.imageUrl).toBeNull();
    expect(result.sourceUrl).toBe(SOURCE);
  });

  it("returns nulls for HTML with no product data", () => {
    const html = "<html><head></head><body><h1>404 Not Found</h1></body></html>";
    const result = parseHTML(html, SOURCE);
    expect(result.name).toBeNull();
    expect(result.brand).toBeNull();
    expect(result.model).toBeNull();
    expect(result.imageUrl).toBeNull();
  });

  it("handles JSON-LD image as array", () => {
    const html = `
      <script type="application/ld+json">
      { "@type": "Product", "name": "Test", "image": ["https://img1.jpg", "https://img2.jpg"] }
      </script>
    `;
    const result = parseHTML(html, SOURCE);
    expect(result.imageUrl).toBe("https://img1.jpg");
  });

  it("handles JSON-LD in @graph format", () => {
    const html = `
      <script type="application/ld+json">
      {
        "@graph": [
          { "@type": "WebPage", "name": "Page" },
          { "@type": "Product", "name": "DJI Mavic 3 Pro", "brand": { "name": "DJI" }, "mpn": "CP.MA.00000660.01" }
        ]
      }
      </script>
    `;
    const result = parseHTML(html, SOURCE);
    expect(result.name).toBe("DJI Mavic 3 Pro");
    expect(result.brand).toBe("DJI");
    expect(result.model).toBe("CP.MA.00000660.01");
  });

  it("handles malformed JSON-LD gracefully", () => {
    const html = `
      <script type="application/ld+json">{ invalid json }</script>
      <meta property="og:title" content="Fallback Title" />
    `;
    const result = parseHTML(html, SOURCE);
    expect(result.name).toBe("Fallback Title");
  });

  it("handles meta tags with reversed attribute order", () => {
    const html = `
      <meta content="https://img.bhphoto.com/reversed.jpg" property="og:image" />
    `;
    const result = parseHTML(html, SOURCE);
    expect(result.imageUrl).toBe("https://img.bhphoto.com/reversed.jpg");
  });
});
