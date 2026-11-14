/** Node-only helper (scripts and tests): read every bundled font as base64. */
import { readFileSync } from "fs";
import { join } from "path";
import { FONT_FAMILIES } from "../design/fonts";
import type { FontData } from "./fonts";

export function nodeFonts(root = process.cwd()): FontData {
  const dir = join(root, "public", "fonts");
  const out: FontData = {};
  for (const f of Object.values(FONT_FAMILIES)) for (const file of [f.regular, f.bold]) out[file] = readFileSync(join(dir, file)).toString("base64");
  return out;
}
