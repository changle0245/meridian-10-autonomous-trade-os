import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MERIDIAN 10 Autonomous Trade OS",
    short_name: "MERIDIAN 10",
    description: "Synthetic Level 10 autonomous foreign-trade operations demo.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f7f5",
    theme_color: "#123139",
  };
}
