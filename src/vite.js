import { svelte } from "@sveltejs/vite-plugin-svelte";
import { glob } from "glob";
import { resolve } from "node:path";
import { addRoute, createRouter, findRoute } from "rou3";
import { render } from "svelte/server";
import {
  HTML_BODY_ID,
  HTML_HEAD_ID,
  HTML_TEMPLATE,
  HTTP_METHODS,
} from "./constants.ts";

/** @import { AppConfig } from "./types.ts"*/

export async function belt() {
  /** @type {AppConfig}  */
  const app = {
    cwd: "",
    router: new Set(),
  };

  /** @type {import('vite').Plugin} */
  const belt_plugin = {
    name: "vite-plugin-belt",
    enforce: "pre",
    config(config) {},
    async configResolved(config) {
      app.cwd = config.root;

      await resolveRoutes(app);
    },
    configureServer(server) {
      server.watcher.on("add", async (file) => {
        for (const route of await resolveRoute(file, app.cwd)) {
          app.router.add(route);
        }
      });
      server.watcher.on("unlink", (file) => {});

      return () =>
        server.middlewares.use(async (req, res, next) => {
          if (!req.originalUrl) return next();

          for (const route of app.router.values()) {
            if (!route.method !== req.method) continue;
          }

          const route = findRoute(
            app.router,
            req.method || "GET",
            req.originalUrl,
          );
          if (!route) return res.end("not-found");

          try {
            const file = await server.ssrLoadModule(route.data.file);

            if (route.data.is_server) {
              const response = (file[req.method] || file.default)?.({
                method: req.method,
                pathname: req.originalUrl,
                headers: req.headers,
                setHeader: res.setHeader,
                setHeaders: res.setHeaders,
                params: route.params,
              });

              if (["object", "number", "bigint"].includes(typeof response)) {
                return res.end(JSON.stringify(response));
              }

              return res.end(response);
            }

            const rendered = render(file.default, {
              context: new Map([["$route_file", route.data.file]]),
            });
            let html = HTML_TEMPLATE.replace(HTML_HEAD_ID, rendered.head);
            html = html.replace(HTML_BODY_ID, rendered.body);

            return res.end(html);
          } catch (e) {
            return console.error(e);
          }
        });
    },
  };

  return [svelte({ configFile: false }), belt_plugin];
}

/** @param {AppConfig} app */
export async function resolveRoutes(app) {
  const globs = await glob("**/*.{svelte,ts}", {
    cwd: resolve(app.cwd, "./routes"),
  });

  for (const file of globs) {
    for (const route of await resolveRoute(file, app.cwd)) {
      app.router.add(route);
    }
  }
}

/**
 * @param {string} file
 * @param {string} cwd
 * */
export async function resolveRoute(file, cwd) {
  const file_path = resolve(cwd, "routes", file);
  let path = file.replaceAll(/\[\.\.\.([\w]+)\]/g, "**:$1");
  path = path.replaceAll(/\[([\w]+)\]/g, ":$1");
  path = path.replaceAll(/(\/)?(index)?\.(svelte|ts|js)$/g, "");

  if (!path.startsWith("/")) path = `/${path}`;

  if (file.endsWith(".svelte")) {
    return [{ path, file: file_path, method: "GET" }];
  }

  /** @type {Record<string, () => any>} */
  const source = await import(file_path);

  /** @type {{path: string, file: string, method: string, is_server?: boolean, math: }[]} */
  const result = [];

  for (const key of Object.keys(source)) {
    if (key === "default") continue;

    result.push({ path, file: file_path, method: key, is_server: true });
  }

  if (!source.default) return result;
  const source_keys = Object.keys(source);

  for (const key of HTTP_METHODS.filter((x) => !source_keys.includes(x))) {
    result.push({ path, file: file_path, method: key, is_server: true });
  }

  return result;
}
