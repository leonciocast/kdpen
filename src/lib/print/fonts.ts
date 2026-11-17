/** Font files (base64) for jsPDF, loaded on demand. Works in the browser, a Web Worker and Node. */
import type { jsPDF } from "jspdf";
import { FONT_FAMILIES, FontKey } from "../design/fonts";
import type { Design } from "../design/types";

/** filename -> base64 TrueType data */
export type FontData = Record<string, string>;

export function familiesFor(design: Design | null): FontKey[] {
  const keys = new Set<FontKey>(["sans", "serif"]);
  if (design) {
    keys.add(design.fonts.heading);
    keys.add(design.fonts.grid);
    keys.add(design.fonts.list);
  }
  return Array.from(keys);
}

export function filesFor(families: FontKey[]): string[] {
  return families.flatMap((k) => [FONT_FAMILIES[k].regular, FONT_FAMILIES[k].bold]);
}

export function registerFonts(pdf: jsPDF, families: FontKey[], data: FontData) {
  for (const k of families) {
    const f = FONT_FAMILIES[k];
    for (const [file, style] of [
      [f.regular, "normal"],
      [f.bold, "bold"],
    ] as const) {
      const b64 = data[file];
      if (!b64) throw new Error(`Font ${file} is not loaded.`);
      pdf.addFileToVFS(file, b64);
      pdf.addFont(file, f.pdfName, style);
    }
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
  return btoa(binary);
}

const cache = new Map<string, Promise<string>>();

/** Fetch fonts from /fonts (browser or worker). `base` is the site origin. */
export async function fetchFonts(files: string[], base = ""): Promise<FontData> {
  const out: FontData = {};
  await Promise.all(
    files.map(async (file) => {
      let p = cache.get(file);
      if (!p) {
        p = fetch(`${base}/fonts/${file}`).then(async (res) => {
          if (!res.ok) throw new Error(`Could not load font ${file}`);
          return toBase64(new Uint8Array(await res.arrayBuffer()));
        });
        cache.set(file, p);
        p.catch(() => cache.delete(file));
      }
      out[file] = await p;
    })
  );
  return out;
}
