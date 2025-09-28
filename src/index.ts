import { svelte } from "@sveltejs/vite-plugin-svelte";
import { glob } from "glob";
import { resolve } from "node:path";
import { render } from "svelte/server";
import {
  HTML_BODY_ID,
  HTML_HEAD_ID,
  HTML_TEMPLATE,
  HTTP_METHODS,
} from "./constants.ts";
import type { Connect, Plugin } from "vite";
import { match, type MatchFunction } from "path-to-regexp";
import { type IncomingHttpHeaders } from "node:http";
import FindMyWay, {
  type Instance,
  type HTTPVersion,
  type HTTPMethod,
} from "find-my-way";

export type HandlerEvent = {
  method: HTTPMethod;
  pathname: string;
  headers: IncomingHttpHeaders;
  params: Record<string, string | string[]>;
  setHeader: (name: string, value: number | string | readonly string[]) => void;
  setHeaders: (
    headers: Headers | Map<string, number | string | readonly string[]>,
  ) => void;
};

export type Handler = (event: HandlerEvent) => any;

export type AppConfig = {
  cwd: string;
  router: Instance<HTTPVersion.V1>;
};

export type Config = {
  app_dir?: string;
  routes_mode?: "both" | "kit" | "fbr";
};

export const defineConfig = (cfg: Config) => cfg;

export async function belt() {
  const app: AppConfig = {
    cwd: "",
    router: FindMyWay(),
  };

  const belt_plugin: Plugin = {
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
          app.router.get(route.path, () => route);
        }
      });
      server.watcher.on("unlink", (file) => {});

      return () =>
        server.middlewares.use(async (req, res, next) => {
          if (!req.originalUrl) return next();
          if (!req.method) return next();

          const matched_route = app.router.find(
            req.method as HTTPMethod,
            req.originalUrl,
          );

          if (!matched_route) return res.end("not-found");
          const route_data: Route = matched_route.handler(req, res, {}, {}, {});

          try {
            const file = await server.ssrLoadModule(route_data.file);

            if (route_data.is_server) {
              const response = (file[req.method] || file.default)?.({
                method: req.method,
                pathname: req.originalUrl,
                headers: req.headers,
                setHeader: res.setHeader,
                setHeaders: res.setHeaders,
                params: matched_route.params,
              });

              if (["object", "number", "bigint"].includes(typeof response)) {
                return res.end(JSON.stringify(response));
              }

              return res.end(response);
            }

            const rendered = render(file.default);
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

export async function resolveRoutes(app: AppConfig) {
  const globs = await glob("**/*.{svelte,ts}", {
    cwd: resolve(app.cwd, "./routes"),
  });

  for (const file of globs) {
    for (const route of await resolveRoute(file, app.cwd)) {
      app.router.get(route.path, () => route);
    }
  }
}

export type Route = {
  path: string;
  file: string;
  method: string;
  is_server?: boolean;
  match: MatchFunction<Partial<Record<string, string | string[]>>>;
  params?: {};
};

export async function resolveRoute(file: string, cwd: string) {
  const file_path = resolve(cwd, "routes", file);
  let path = file.replaceAll(/\[\.\.\.([\w]+)\]/g, "*$1");
  path = path.replaceAll(/\[([\w]+)\]/g, ":$1");
  path = path.replaceAll(/(\/)?(index)?\.(svelte|ts|js)$/g, "");

  if (!path.startsWith("/")) path = `/${path}`;

  if (file.endsWith(".svelte")) {
    return [{ path, file: file_path, method: "GET", match: match(path) }];
  }

  const source: Record<string, () => any> = await import(file_path);

  const result: Route[] = [];

  for (const key of Object.keys(source)) {
    if (key === "default") continue;

    match(path);

    result.push({
      path,
      file: file_path,
      method: key,
      is_server: true,
      match: match(path),
    });
  }

  if (!source.default) return result;
  const source_keys = Object.keys(source);

  for (const key of HTTP_METHODS.filter((x) => !source_keys.includes(x))) {
    result.push({
      path,
      file: file_path,
      method: key,
      is_server: true,
      match: match(path),
    });
  }

  return result;
}
