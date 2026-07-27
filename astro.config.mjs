import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
  site: "https://YOUR_USERNAME.github.io",
  base: "/emotelab-query",
  build: {
    assets: "assets",
  },
});
