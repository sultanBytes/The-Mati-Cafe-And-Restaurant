import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { menuImageUploadPlugin } from "./scripts/vite-menu-upload-plugin.mjs";

function githubPagesSpaFallback() {
  return {
    name: "gh-pages-spa-fallback",
    closeBundle() {
      const dist = path.resolve("dist");
      const index = path.join(dist, "index.html");
      if (fs.existsSync(index)) {
        fs.copyFileSync(index, path.join(dist, "404.html"));
        fs.writeFileSync(path.join(dist, ".nojekyll"), "");
      }
    },
  };
}

export default defineConfig({
  base: process.env.GITHUB_PAGES === "true" ? "/The-Mati-Cafe-And-Restaurant/" : "/",
  plugins: [react(), tailwindcss(), menuImageUploadPlugin(), githubPagesSpaFallback()],
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
  },
  build: {
    sourcemap: false,
    assetsInlineLimit: 4096,
  },
});
