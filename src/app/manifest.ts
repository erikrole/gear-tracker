import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wisconsin Creative",
    short_name: "Creative",
    description: "Equipment checkout, reservation, and scan tracking for university athletics",
    start_url: "/",
    display: "standalone",
    background_color: "#0f1117",
    theme_color: "#A00000",
    icons: [
      {
        src: "/Badgers.png",
        sizes: "any",
        type: "image/png",
      },
    ],
  };
}
