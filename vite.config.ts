import { defineConfig } from "vite";
import { belt } from "vite-plugin-belt";

export default defineConfig({
  root: "docs",
  plugins: [belt()],
});
