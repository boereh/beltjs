import { defineEventHandler } from "vinxi/http";
import { SOURCE_DIR } from "./constants";

export default defineEventHandler(async (event, ...args) => {
  console.log(event, args);
  return "hello";
});
