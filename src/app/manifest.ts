import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gear Tracker",
    short_name: "Gear",
    description: "Equipment checkout, reservation, and scan tracking for university athletics",
    start_url: "/",
    display: "standalone",
    background_color: "#0f1117",
    theme_color: "#c5050c",
    icons: [
      {
        src: "/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
      },
      {
        src: "/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
      },
    ],
  };
}
