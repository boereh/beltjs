import { defineBuildConfig } from "obuild/config";
import { dependencies } from "./package.json";
import svelte from "rollup-plugin-svelte";
import { writeFile, readFile } from "node:fs/promises";

export default defineBuildConfig({
  entries: [
    {
      type: "bundle",
      input: [
        "src/cli.ts",
        "src/index.ts",
        "src/server.ts",
        "src/client.ts",
        "src/config.ts",
      ],
      minify: true,
      dts: true,
      rolldown: {
        plugins: [svelte()],
        external: [...Object.keys(dependencies)],
      },
    },
  ],
  hooks: {
    async end(ctx) {
      const entry = await readFile("./src/entry.html", "utf8");

      await writeFile("./dist/entry.html", entry);
    },
  },
});
