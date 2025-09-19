import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SOURCE_DIR = resolve(fileURLToPath(import.meta.url), "..");
