import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: "https://meridian-10-autonomous-trade-os.vercel.app/", lastModified: "2026-08-09", changeFrequency: "monthly", priority: 1 }];
}
