import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SOURCE_DIR = resolve(fileURLToPath(import.meta.url), "..");

export const HTML_HEAD_ID = "<!--%belt.head%-->";
export const HTML_BODY_ID = "<!--%belt.body%-->";
export const HTML_TEMPLATE = `<!doctype html>
<html lang="en">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        ${HTML_HEAD_ID}
    </head>
    <body>
        <div style="display: contents">${HTML_BODY_ID}</div>
    </body>
</html>`;
export const HTTP_METHODS = [
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "DELETE",
  "CONNECT",
  "OPTIONS",
  "TRACE",
  "PATCH",
];
