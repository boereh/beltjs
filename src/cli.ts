import { defineCommand, runMain } from "citty";
import {
  name,
  description,
  version,
} from "../package.json" with { type: "json" };
import { isAbsolute, resolve } from "path";
import { Connect, createServer, ViteDevServer } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { addRoute, createRouter, findRoute, RouterContext } from "rou3";
import { glob } from "glob";
import { render } from "svelte/server";
import { readFile } from "node:fs/promises";
import {
  HTML_BODY_ID,
  HTML_HEAD_ID,
  HTML_TEMPLATE,
  HTTP_METHODS,
} from "./constants";

type AppConfig = {
  cwd: string;
  router: RouterContext<{
    file: string;
    action?: <T>(req: Connect.IncomingMessage) => T;
  }>;
};

const dev_command = defineCommand({
  meta: {
    name: "dev",
    description: "Start the belt development server",
    version,
  },
  args: {
    cwd: {
      description: "Path to the application folder",
      type: "positional",
      default: ".",
    },
  },
  async run({ args }) {
    if (!isAbsolute(args.cwd)) args.cwd = resolve(process.cwd(), args.cwd);

    const app: AppConfig = {
      cwd: args.cwd,
      router: createRouter(),
    };

    // const config: Object = await import(resolve(app.cwd, "./belt.config.ts"));

    const vite = await createServer({
      optimizeDeps: {
        include: [`${app.cwd}/routes/**/*`],
        extensions: ["svelte", "ts", "js"],
      },
      publicDir: resolve(app.cwd, "public"),
      plugins: [
        svelte({
          configFile: false,
        }),
        {
          name: "vite-plugin-belt",
          enforce: "pre",
        },
      ],
    });

    await resolveRoutes(app, vite);

    await vite.listen();
    vite.printUrls();
  },
});

export async function resolveRoutes(app: AppConfig, vite: ViteDevServer) {
  const globs = await glob("**/*.{svelte,ts}", {
    cwd: resolve(app.cwd, "./routes"),
  });

  for (const file of globs) {
    const file_path = resolve(app.cwd, "routes", file);
    let path = file.replaceAll(/\[\.\.\.([\w]+)\]/g, "**:$1");
    path = path.replaceAll(/\[([\w]+)\]/g, ":$1");
    path = path.replaceAll(/(\/)?(index)?\.(svelte|ts|js)$/g, "");

    if (!path.startsWith("/")) path = `/${path}`;

    if (file.endsWith(".svelte")) {
      addRoute(app.router, "GET", path, {
        file: file_path,
      });

      continue;
    }

    const source: Record<string, () => any> = await import(file_path);

    for (const [key, fn] of Object.entries(source)) {
      if (key === "default") continue;

      addRoute(app.router, key, path, {
        file: file_path,
        action: fn,
      });
    }

    if (!source.default) continue;
    const source_keys = Object.keys(source);

    for (const key of HTTP_METHODS.filter((x) => source_keys.includes(x))) {
      addRoute(app.router, key, path, {
        file: file_path,
        action: source.default,
      });
    }
  }
}

runMain({
  meta: {
    name,
    description,
    version,
  },
  subCommands: {
    dev: dev_command,
  },
});
