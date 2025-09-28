import { defineConfig } from "vite";
import { belt } from "@beltjs/belt";

export default defineConfig({
  root: "docs",
  plugins: [belt()],
});
