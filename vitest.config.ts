import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(root, "src") },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    coverage: { reporter: ["text", "json-summary"] },
  },
});
