/** Node-only helper (scripts and tests): read the bundled fonts as base64. */
import { readFileSync } from "fs";
import { join } from "path";
import type { PdfFonts } from "./book";

export function nodeFonts(root = process.cwd()): PdfFonts {
  const dir = join(root, "public", "fonts");
  const read = (f: string) => readFileSync(join(dir, f)).toString("base64");
  return {
    sans: read("DejaVuSans.ttf"),
    sansBold: read("DejaVuSans-Bold.ttf"),
    serif: read("DejaVuSerif.ttf"),
    serifBold: read("DejaVuSerif-Bold.ttf"),
  };
}
