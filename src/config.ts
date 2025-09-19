import { createApp as createVinxiApp } from "vinxi";
import { fileURLToPath } from "node:url";
import { resolve } from "path";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { Plugin } from "vite";
import { SOURCE_DIR } from "./constants";
import { addRoute, createRouter, RouterContext } from "rou3";
import { compileRouterToString } from "rou3/compiler";
import { glob } from "glob";

export type Belt = {
  cwd: string;
  router: RouterContext<{ file: string }>;
};

export function createApp() {
  return createVinxiApp({
    routers: [
      {
        name: "api",
        type: "http",
        handler: `${SOURCE_DIR}/server.mjs`,
        base: "/api",
        plugins: async () => [
          svelte({
            configFile: false,
          }),
          await belt_plugin(),
        ],
      },
      {
        name: "ssr",
        type: "client",
        base: "/_build",
        target: "browser",
        handler: `${SOURCE_DIR}/entry.html`,
        async plugins(context) {
          console.log(context);

          return [
            svelte({
              configFile: false,
            }),
            await belt_plugin(),
          ];
        },
      },
    ],
  });
}

export async function belt_plugin() {
  const belt: Belt = {
    cwd: "",
    router: createRouter(),
  };

  await resolveRoutes(belt);

  const plugin: Plugin = {
    name: "vite-plugin-belt",
    transform(code, id, options) {
      console.log(code);
      if (code.includes("<!--%belt.head%-->")) {
        code.replace(
          "<!--%belt.head%-->",
          `<script src="${SOURCE_DIR}/client.mjs"></script>`,
        );

        return code;
      }

      if (id === "$router") {
        return compileRouterToString(app.router);
      }
    },
  };

  return plugin;
}

export async function resolveRoutes(app: Belt) {
  const globs = await glob("**/*.{svelte,ts}", {
    cwd: resolve(app.cwd, "app/routes"),
  });

  for (const file of globs) {
    let path = file.replaceAll(/\[\.\.\.([\w]+)\]/g, "**:$1");
    path = path.replaceAll(/\[([\w]+)\]/g, ":$1");
    path = path.replaceAll(/(\/)?(index)?\.(svelte|ts|js)$/g, "");

    if (!path.startsWith("/")) path = `/${path}`;

    if (file.endsWith(".svelte")) {
      addRoute(app.router, "GET", path, {
        file: `${app.cwd}/${file}`,
      });
    } else if (file.endsWith(".ts") || file.endsWith(".js")) {
      addRoute(app.router, "GET", path, {
        file: `${app.cwd}/${file}`,
      });
    }
  }
}
