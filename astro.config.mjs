import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
  site: "https://lightbulb128.github.io",
  base: "/emote-search",
  build: {
    assets: "assets",
  },
});
