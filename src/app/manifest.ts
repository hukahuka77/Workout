import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Workout", short_name: "Workout", start_url: "/app", display: "standalone",
    background_color: "#f5f9f7", theme_color: "#188978",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
