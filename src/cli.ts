import { defineCommand, runMain } from "citty";
import {
  name,
  description,
  version,
} from "../package.json" with { type: "json" };
import { isAbsolute, resolve } from "path";
import { createServer } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import {
  addRoute,
  createRouter,
  findRoute,
  RouterContext,
  findAllRoutes,
} from "rou3";
import { readFile } from "node:fs/promises";
import { glob } from "glob";
import { Component } from "svelte";
import { render } from "svelte/server";

export const HTML_TEMPLATE = `<!doctype html>
<html lang="en">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <!--%belt.head%-->
    </head>
    <body>
        <div style="display: contents"><!--%belt.body%--></div>
    </body>
</html>`;

type AppConfig = {
  cwd: string;
  router: RouterContext<{ file: string }>;
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

    await resolveRoutes(app);

    const vite = await createServer({
      publicDir: resolve(app.cwd, "public"),
      plugins: [
        svelte({
          configFile: false,
        }),
        {
          name: "vite-plugin-belt",
          configureServer(server) {
            return () =>
              server.middlewares.use(async (req, res, next) => {
                if (!req.originalUrl) {
                  return next();
                }

                const route = findRoute(
                  app.router,
                  req.method || "GET",
                  req.originalUrl,
                );

                if (!route) return res.end("not-found");
                const file_path = resolve(
                  app.cwd,
                  "app/routes",
                  route.data.file,
                );

                const file = await server.ssrLoadModule(file_path);
                const rendered = render(file.default);
                let html = HTML_TEMPLATE.replace(
                  "<!--%belt.body%-->",
                  rendered.body,
                ).replace("<!--%belt.head%-->", rendered.head);

                res.end(html);
              });
          },
        },
      ],
    });
    await vite.listen();
    vite.printUrls();
  },
});

export async function resolveRoutes(app: AppConfig) {
  const globs = await glob("**/*{.svelte,.ts}", {
    cwd: resolve(app.cwd, "./routes"),
  });

  for (const file of globs) {
    let path = file.replaceAll(/\[\.\.\.([\w]+)\]/g, "**:$1");
    path = path.replaceAll(/\[([\w]+)\]/g, ":$1");
    path = path.replaceAll(/(\/)?(index)?\.(svelte|ts|js)$/g, "");

    if (!path.startsWith("/")) path = `/${path}`;

    if (file.endsWith(".svelte")) {
      addRoute(app.router, "GET", path, {
        file: `${app.cwd}/routes/${file}`,
      });
    }
    // } else if (file.endsWith(".ts") || file.endsWith(".js")) {
    //   addRoute(app.router, "GET", path, {
    //     file: `${app.cwd}/${file}`,
    //   });
    // }
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
